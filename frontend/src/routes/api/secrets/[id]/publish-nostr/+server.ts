/**
 * Register and optionally relay already-signed opaque Nostr v2 artifacts.
 * Plaintext shares, K values, passphrases, and unsigned capsules are rejected by
 * the strict request shape before any database mutation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { requireSession } from '$lib/server/auth';
import { getDatabase } from '$lib/db/drizzle';
import { secretRecipients, secrets } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getEventHash, verifyEvent } from 'nostr-tools/pure';
import {
	parseNostrEvent,
	parseVerifiedManifest,
	RECOVERY_CAPSULE_VERSION
} from '$lib/nostr/recovery-capsule';
import { createNostrClient } from '$lib/nostr/client';
import { scheduleRemindersForSecret } from '$lib/services/reminder-scheduler';

const requestSchema = z
	.object({
		artifacts: z
			.array(
				z
					.object({
						giftWrapEvent: z.unknown(),
						manifestEvent: z.unknown()
					})
					.strict()
			)
			.min(1)
			.max(10)
	})
	.strict();

export const POST: RequestHandler = async (event) => {
	const csrfCheck = await requireCSRFProtection(event);
	if (!csrfCheck.valid) return createCSRFErrorResponse();

	const session = await requireSession(event);
	const parsed = requestSchema.safeParse(await event.request.json());
	if (!parsed.success) {
		return json({ error: 'Only signed opaque Nostr v2 artifacts are accepted' }, { status: 400 });
	}

	const db = await getDatabase();
	const secretId = event.params.id;
	const [secret] = await db
		.select({
			id: secrets.id,
			status: secrets.status,
			checkInDays: secrets.checkInDays,
			nostrDeliveryStatus: secrets.nostrDeliveryStatus,
			bitcoinDeliveryStatus: secrets.bitcoinDeliveryStatus
		})
		.from(secrets)
		.where(and(eq(secrets.id, secretId), eq(secrets.userId, session.user.id)));

	if (!secret) return json({ error: 'Secret not found' }, { status: 404 });
	if (secret.nostrDeliveryStatus !== 'pending') {
		return json({ error: 'Nostr v2 enrollment is not pending' }, { status: 409 });
	}

	const recipients = await db
		.select({ id: secretRecipients.id, nostrPubkey: secretRecipients.nostrPubkey })
		.from(secretRecipients)
		.where(eq(secretRecipients.secretId, secretId));
	const expected = new Map(
		recipients
			.filter(
				(recipient): recipient is { id: string; nostrPubkey: string } =>
					typeof recipient.nostrPubkey === 'string'
			)
			.map((recipient) => [recipient.id, recipient.nostrPubkey])
	);

	try {
		const verified = parsed.data.artifacts.map((artifact) => {
			const giftWrapEvent = parseNostrEvent(artifact.giftWrapEvent);
			const manifestEvent = parseNostrEvent(artifact.manifestEvent);
			const manifest = parseVerifiedManifest(manifestEvent);
			const expectedPubkey = expected.get(manifest.recipientId);

			if (
				manifest.version !== RECOVERY_CAPSULE_VERSION ||
				manifest.secretId !== secretId ||
				!expectedPubkey ||
				manifest.recipientNostrPubkey !== expectedPubkey
			) {
				throw new Error('Recovery manifest context does not match the owned secret');
			}
			if (
				!verifyEvent(giftWrapEvent) ||
				giftWrapEvent.id !== getEventHash(giftWrapEvent) ||
				giftWrapEvent.id !== manifest.giftWrapEventId ||
				giftWrapEvent.kind !== 1059 ||
				JSON.stringify(giftWrapEvent.tags) !== JSON.stringify([['p', expectedPubkey]])
			) {
				throw new Error('Invalid signed gift wrap');
			}
			if (giftWrapEvent.content.length > 131_072) throw new Error('Gift wrap is too large');

			return { giftWrapEvent, manifestEvent, manifest };
		});

		const recipientIds = new Set(verified.map(({ manifest }) => manifest.recipientId));
		const publishers = new Set(verified.map(({ manifest }) => manifest.publisherPubkey));
		if (recipientIds.size !== expected.size || recipientIds.size !== verified.length) {
			throw new Error('Exactly one artifact is required for every Nostr recipient');
		}
		if (publishers.size !== 1) throw new Error('All artifacts must use one per-secret publisher');

		// Best-effort opaque relay retry. Direct browser publication already
		// succeeded before registration, so relay availability does not control the
		// durable manifest commit.
		const relayWarnings: string[] = [];
		const client = createNostrClient();
		try {
			for (const artifact of verified) {
				try {
					await client.publish(artifact.giftWrapEvent);
				} catch (error) {
					relayWarnings.push(error instanceof Error ? error.message : 'Opaque relay retry failed');
				}
			}
		} finally {
			client.close();
		}

		const activatedAt = new Date();
		const shouldActivate = secret.bitcoinDeliveryStatus !== 'pending';
		await db.transaction(async (tx) => {
			for (const artifact of verified) {
				await tx
					.update(secretRecipients)
					.set({
						nostrPublisherPubkey: artifact.manifest.publisherPubkey,
						nostrGiftWrapEventId: artifact.manifest.giftWrapEventId,
						nostrCapsuleEventId: artifact.manifest.capsuleEventId,
						nostrManifestEvent: artifact.manifestEvent,
						nostrSchemeVersion: RECOVERY_CAPSULE_VERSION,
						updatedAt: activatedAt
					})
					.where(
						and(
							eq(secretRecipients.id, artifact.manifest.recipientId),
							eq(secretRecipients.secretId, secretId)
						)
					);
			}

			await tx
				.update(secrets)
				.set({
					nostrDeliveryStatus: 'ready',
					...(shouldActivate
						? {
								status: 'active' as const,
								lastCheckIn: activatedAt,
								nextCheckIn: new Date(
									activatedAt.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000
								)
							}
						: {}),
					updatedAt: activatedAt
				})
				.where(eq(secrets.id, secretId));
		});

		if (shouldActivate) {
			await scheduleRemindersForSecret(
				secretId,
				new Date(activatedAt.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000),
				secret.checkInDays
			);
		}

		return json({
			registered: verified.map(({ manifest }) => manifest),
			active: shouldActivate,
			relayWarnings
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Invalid Nostr artifact' },
			{ status: 400 }
		);
	}
};
