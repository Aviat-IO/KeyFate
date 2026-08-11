import { Buffer } from 'buffer';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { requireCSRFProtection, createCSRFErrorResponse } from '$lib/csrf';
import { requireSession } from '$lib/server/auth';
import { getDatabase } from '$lib/db/drizzle';
import { secretRecipients, secrets } from '$lib/db/schema';
import { decryptMessage } from '$lib/encryption';
import { parseNostrEvent } from '$lib/nostr/recovery-capsule';
import {
	NOSTR_RECOVERY_V3_VERSION,
	parseVerifiedCapsuleV3,
	parseVerifiedManifestV3,
	verifyOuterGiftWrapV3,
	type RecoveryManifestV3Content
} from '$lib/nostr/recovery-v3-artifact';
import { createNostrClient } from '$lib/nostr/client';
import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
import { validateRecoveryShareEnvelopeContext } from '$lib/crypto/recovery-v3';

const requestSchema = z
	.object({
		artifacts: z
			.array(
				z
					.object({
						giftWrapEvent: z.unknown(),
						capsuleEvent: z.unknown(),
						manifestEvent: z.unknown()
					})
					.strict()
			)
			.min(1)
			.max(5)
	})
	.strict();

function sameRelayHints(
	left: RecoveryManifestV3Content,
	right: RecoveryManifestV3Content
): boolean {
	return JSON.stringify(left.relayHints) === JSON.stringify(right.relayHints);
}

export const POST: RequestHandler = async (event) => {
	const csrfCheck = await requireCSRFProtection(event);
	if (!csrfCheck.valid) return createCSRFErrorResponse();
	const session = await requireSession(event);
	const request = requestSchema.safeParse(await event.request.json());
	if (!request.success) {
		return json(
			{ error: 'Only complete signed opaque Nostr v3 artifacts are accepted' },
			{ status: 400 }
		);
	}

	const db = await getDatabase();
	const secretId = event.params.id;
	const [secret] = await db
		.select({
			id: secrets.id,
			nostrDeliveryStatus: secrets.nostrDeliveryStatus,
			sssThreshold: secrets.sssThreshold,
			sssSharesTotal: secrets.sssSharesTotal,
			serverShare: secrets.serverShare,
			iv: secrets.iv,
			authTag: secrets.authTag,
			keyVersion: secrets.keyVersion
		})
		.from(secrets)
		.where(and(eq(secrets.id, secretId), eq(secrets.userId, session.user.id)));
	if (!secret) return json({ error: 'Secret not found' }, { status: 404 });
	if (!['pending', 'registered', 'ready'].includes(secret.nostrDeliveryStatus ?? '')) {
		return json({ error: 'Nostr v3 enrollment is not available for this secret' }, { status: 409 });
	}
	if (!secret.serverShare || !secret.iv || !secret.authTag) {
		return json({ error: 'Stored authenticated service envelope is unavailable' }, { status: 409 });
	}

	let serviceEnvelope: ReturnType<typeof validateRecoveryShareEnvelopeContext>;
	const iv = Buffer.from(secret.iv, 'base64');
	const authTag = Buffer.from(secret.authTag, 'base64');
	try {
		const serialized = await decryptMessage(
			secret.serverShare,
			iv,
			authTag,
			secret.keyVersion ?? 1
		);
		serviceEnvelope = validateRecoveryShareEnvelopeContext(serialized, {
			index: 1,
			threshold: 2,
			total: secret.sssSharesTotal
		});
	} catch {
		return json({ error: 'Stored authenticated service envelope is invalid' }, { status: 409 });
	} finally {
		iv.fill(0);
		authTag.fill(0);
	}

	const recipients = await db
		.select({
			id: secretRecipients.id,
			nostrPubkey: secretRecipients.nostrPubkey,
			nostrPublisherPubkey: secretRecipients.nostrPublisherPubkey,
			nostrGiftWrapEventId: secretRecipients.nostrGiftWrapEventId,
			nostrCapsuleEventId: secretRecipients.nostrCapsuleEventId,
			nostrManifestEvent: secretRecipients.nostrManifestEvent,
			nostrSchemeVersion: secretRecipients.nostrSchemeVersion
		})
		.from(secretRecipients)
		.where(eq(secretRecipients.secretId, secretId));
	const expected = new Map(
		recipients
			.filter((recipient): recipient is typeof recipient & { nostrPubkey: string } =>
				Boolean(recipient.nostrPubkey)
			)
			.map((recipient) => [recipient.id, recipient])
	);
	if (expected.size === 0 || expected.size !== recipients.length) {
		return json(
			{ error: 'Every recipient requires a registered Nostr public key' },
			{ status: 409 }
		);
	}

	try {
		const verified = request.data.artifacts.map((artifact) => {
			const giftWrapEvent = parseNostrEvent(artifact.giftWrapEvent);
			const capsuleEvent = parseNostrEvent(artifact.capsuleEvent);
			const manifestEvent = parseNostrEvent(artifact.manifestEvent);
			const manifest = parseVerifiedManifestV3(manifestEvent);
			const recipient = expected.get(manifest.recipientId);
			if (
				manifest.secretId !== secretId ||
				manifest.threshold !== 2 ||
				manifest.threshold !== secret.sssThreshold ||
				manifest.totalShares !== secret.sssSharesTotal ||
				manifest.setId !== serviceEnvelope.setId ||
				manifest.ciphertextDigestHex !== serviceEnvelope.protectedSecret.ciphertextDigestHex ||
				!recipient ||
				manifest.recipientNostrPubkey !== recipient.nostrPubkey
			) {
				throw new Error('V3 manifest context does not match the owned service envelope');
			}
			verifyOuterGiftWrapV3(giftWrapEvent, manifest);
			parseVerifiedCapsuleV3(capsuleEvent, manifest);
			const storedManifestId = recipient.nostrManifestEvent
				? parseNostrEvent(recipient.nostrManifestEvent).id
				: null;
			if (
				recipient.nostrSchemeVersion !== null &&
				(recipient.nostrSchemeVersion !== NOSTR_RECOVERY_V3_VERSION ||
					recipient.nostrPublisherPubkey !== manifest.publisherPubkey ||
					recipient.nostrGiftWrapEventId !== manifest.giftWrapEventId ||
					recipient.nostrCapsuleEventId !== manifest.capsuleEventId ||
					storedManifestId !== manifestEvent.id)
			) {
				throw new Error('Registered Nostr artifact cannot be replaced');
			}
			return { giftWrapEvent, capsuleEvent, manifestEvent, manifest };
		});

		const recipientIds = new Set(verified.map(({ manifest }) => manifest.recipientId));
		if (recipientIds.size !== expected.size || verified.length !== expected.size) {
			throw new Error('Exactly one v3 artifact is required for every Nostr recipient');
		}
		const first = verified[0].manifest;
		for (const { manifest } of verified) {
			if (
				manifest.publisherPubkey !== first.publisherPubkey ||
				manifest.setId !== first.setId ||
				manifest.threshold !== 2 ||
				manifest.totalShares !== first.totalShares ||
				manifest.shareIndex !== 2 ||
				manifest.ciphertextDigestHex !== first.ciphertextDigestHex ||
				!sameRelayHints(manifest, first)
			) {
				throw new Error('V3 artifacts do not share one recovery context and relay set');
			}
		}

		const configuredRelays = new Set(DEFAULT_RELAYS);
		if (first.relayHints.some((relay) => !configuredRelays.has(relay))) {
			throw new Error('Signed relay hints must use the configured relay allowlist');
		}
		const relayFailures: string[] = [];
		const client = createNostrClient({ relays: first.relayHints });
		try {
			for (const artifact of verified) {
				try {
					await client.publish(artifact.giftWrapEvent);
				} catch (error) {
					relayFailures.push(
						error instanceof Error ? error.message : 'Opaque relay publication failed'
					);
				}
			}
		} finally {
			client.close();
		}
		if (relayFailures.length > 0) {
			return json(
				{
					error: 'Not every recipient artifact reached the signed relay set; retry exact artifacts',
					relayFailures
				},
				{ status: 503 }
			);
		}

		if (secret.nostrDeliveryStatus !== 'ready') {
			const now = new Date();
			await db.transaction(async (tx) => {
				for (const artifact of verified) {
					const [updated] = await tx
						.update(secretRecipients)
						.set({
							nostrPublisherPubkey: artifact.manifest.publisherPubkey,
							nostrGiftWrapEventId: artifact.manifest.giftWrapEventId,
							nostrCapsuleEventId: artifact.manifest.capsuleEventId,
							nostrManifestEvent: artifact.manifestEvent,
							nostrSchemeVersion: NOSTR_RECOVERY_V3_VERSION,
							updatedAt: now
						})
						.where(
							and(
								eq(secretRecipients.id, artifact.manifest.recipientId),
								eq(secretRecipients.secretId, secretId),
								or(
									and(
										isNull(secretRecipients.nostrSchemeVersion),
										isNull(secretRecipients.nostrPublisherPubkey),
										isNull(secretRecipients.nostrGiftWrapEventId),
										isNull(secretRecipients.nostrCapsuleEventId),
										isNull(secretRecipients.nostrManifestEvent)
									),
									and(
										eq(secretRecipients.nostrSchemeVersion, NOSTR_RECOVERY_V3_VERSION),
										eq(secretRecipients.nostrPublisherPubkey, artifact.manifest.publisherPubkey),
										eq(secretRecipients.nostrGiftWrapEventId, artifact.manifest.giftWrapEventId),
										eq(secretRecipients.nostrCapsuleEventId, artifact.manifest.capsuleEventId),
										eq(secretRecipients.nostrManifestEvent, artifact.manifestEvent)
									)
								)
							)
						)
						.returning({ id: secretRecipients.id });
					if (!updated) throw new Error('Concurrent Nostr artifact replacement rejected');
				}
				const [registered] = await tx
					.update(secrets)
					.set({ nostrDeliveryStatus: 'registered', updatedAt: now })
					.where(
						and(
							eq(secrets.id, secretId),
							eq(secrets.userId, session.user.id),
							or(
								eq(secrets.nostrDeliveryStatus, 'pending'),
								eq(secrets.nostrDeliveryStatus, 'registered')
							)
						)
					)
					.returning({ id: secrets.id });
				if (!registered) throw new Error('Nostr enrollment state changed concurrently');
			});
		}

		return json({
			registered: verified.map(({ manifest }) => manifest),
			status: secret.nostrDeliveryStatus === 'ready' ? 'ready' : 'registered',
			active: false,
			relayWarnings: []
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid Nostr v3 artifact';
		const normalized = message.toLowerCase();
		return json(
			{ error: message },
			{
				status:
					normalized.includes('concurrent') || normalized.includes('cannot be replaced') ? 409 : 400
			}
		);
	}
};
