import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { requireSession } from '$lib/server/auth';
import { getDatabase } from '$lib/db/drizzle';
import { reminderJobs, secretRecipients, secrets } from '$lib/db/schema';
import {
	calculateScheduledFor,
	getApplicableReminderTypes
} from '$lib/services/reminder-scheduler';
import {
	NOSTR_RECOVERY_V3_VERSION,
	parseVerifiedManifestV3
} from '$lib/nostr/recovery-v3-artifact';
import { parseNostrEvent } from '$lib/nostr/recovery-capsule';

export const POST: RequestHandler = async (event) => {
	const csrfCheck = await requireCSRFProtection(event);
	if (!csrfCheck.valid) return createCSRFErrorResponse();
	const session = await requireSession(event);
	const db = await getDatabase();
	const secretId = event.params.id;
	const [secret] = await db
		.select({
			id: secrets.id,
			status: secrets.status,
			nostrDeliveryStatus: secrets.nostrDeliveryStatus,
			bitcoinDeliveryStatus: secrets.bitcoinDeliveryStatus,
			checkInDays: secrets.checkInDays,
			nextCheckIn: secrets.nextCheckIn
		})
		.from(secrets)
		.where(and(eq(secrets.id, secretId), eq(secrets.userId, session.user.id)));
	if (!secret) return json({ error: 'Secret not found' }, { status: 404 });
	if (secret.nostrDeliveryStatus === 'ready') {
		return json({ status: 'ready', active: secret.status === 'active', idempotent: true });
	}
	if (secret.nostrDeliveryStatus !== 'registered') {
		return json(
			{ error: 'Complete v3 artifact registration before finalization' },
			{ status: 409 }
		);
	}

	const recipients = await db
		.select({
			id: secretRecipients.id,
			nostrPubkey: secretRecipients.nostrPubkey,
			nostrSchemeVersion: secretRecipients.nostrSchemeVersion,
			nostrPublisherPubkey: secretRecipients.nostrPublisherPubkey,
			nostrGiftWrapEventId: secretRecipients.nostrGiftWrapEventId,
			nostrCapsuleEventId: secretRecipients.nostrCapsuleEventId,
			nostrManifestEvent: secretRecipients.nostrManifestEvent
		})
		.from(secretRecipients)
		.where(eq(secretRecipients.secretId, secretId));
	const required = recipients.filter((recipient) => recipient.nostrPubkey);
	if (
		required.length === 0 ||
		required.length !== recipients.length ||
		required.some(
			(recipient) =>
				recipient.nostrSchemeVersion !== NOSTR_RECOVERY_V3_VERSION ||
				!recipient.nostrPublisherPubkey ||
				!recipient.nostrGiftWrapEventId ||
				!recipient.nostrCapsuleEventId ||
				!recipient.nostrManifestEvent
		)
	) {
		return json(
			{ error: 'Every recipient requires a complete registered v3 artifact' },
			{ status: 409 }
		);
	}

	try {
		const manifests = required.map((recipient) => {
			const manifest = parseVerifiedManifestV3(parseNostrEvent(recipient.nostrManifestEvent));
			if (
				manifest.secretId !== secretId ||
				manifest.recipientId !== recipient.id ||
				manifest.recipientNostrPubkey !== recipient.nostrPubkey ||
				manifest.publisherPubkey !== recipient.nostrPublisherPubkey ||
				manifest.giftWrapEventId !== recipient.nostrGiftWrapEventId ||
				manifest.capsuleEventId !== recipient.nostrCapsuleEventId
			)
				throw new Error('Stored v3 manifest binding mismatch');
			return manifest;
		});
		const first = manifests[0];
		if (
			manifests.some(
				(manifest) =>
					manifest.publisherPubkey !== first.publisherPubkey ||
					manifest.setId !== first.setId ||
					manifest.threshold !== first.threshold ||
					manifest.totalShares !== first.totalShares ||
					manifest.shareIndex !== first.shareIndex ||
					manifest.ciphertextDigestHex !== first.ciphertextDigestHex
			)
		)
			throw new Error('Stored v3 manifests do not share one recovery context');
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Invalid registered v3 manifest' },
			{ status: 409 }
		);
	}

	try {
		const outcome = await db.transaction(async (tx) => {
			const [locked] = await tx
				.select({
					status: secrets.status,
					nostrDeliveryStatus: secrets.nostrDeliveryStatus,
					bitcoinDeliveryStatus: secrets.bitcoinDeliveryStatus,
					checkInDays: secrets.checkInDays
				})
				.from(secrets)
				.where(and(eq(secrets.id, secretId), eq(secrets.userId, session.user.id)))
				.for('update');
			if (!locked) throw new Error('Secret disappeared during finalization');
			if (locked.nostrDeliveryStatus === 'ready') {
				return { active: locked.status === 'active', idempotent: true };
			}
			if (locked.nostrDeliveryStatus !== 'registered') {
				throw new Error('Nostr enrollment state changed before finalization');
			}

			const now = new Date();
			const shouldActivate = locked.bitcoinDeliveryStatus !== 'pending';
			const nextCheckIn = shouldActivate
				? new Date(now.getTime() + locked.checkInDays * 24 * 60 * 60 * 1000)
				: null;

			if (shouldActivate && nextCheckIn) {
				await tx
					.update(reminderJobs)
					.set({ status: 'cancelled' as const, updatedAt: now })
					.where(and(eq(reminderJobs.secretId, secretId), eq(reminderJobs.status, 'pending')));
				for (const reminderType of getApplicableReminderTypes(nextCheckIn, locked.checkInDays)) {
					const scheduledFor = calculateScheduledFor(reminderType, nextCheckIn, locked.checkInDays);
					if (scheduledFor <= now) continue;
					await tx
						.insert(reminderJobs)
						.values({ secretId, reminderType, scheduledFor, status: 'pending' })
						.onConflictDoNothing({
							target: [reminderJobs.secretId, reminderJobs.reminderType, reminderJobs.scheduledFor]
						});
				}
			}

			const [transitioned] = await tx
				.update(secrets)
				.set({
					nostrDeliveryStatus: 'ready',
					...(shouldActivate && nextCheckIn
						? { status: 'active' as const, lastCheckIn: now, nextCheckIn }
						: {}),
					updatedAt: now
				})
				.where(
					and(
						eq(secrets.id, secretId),
						eq(secrets.userId, session.user.id),
						eq(secrets.nostrDeliveryStatus, 'registered')
					)
				)
				.returning({ id: secrets.id });
			if (!transitioned) throw new Error('Nostr readiness transition lost its lock');
			return { active: shouldActivate, idempotent: false };
		});
		return json({ status: 'ready', ...outcome });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Nostr finalization failed' },
			{ status: 409 }
		);
	}
};
