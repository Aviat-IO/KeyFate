import { finalizeEvent, getEventHash, verifyEvent } from 'nostr-tools/pure';
import type { Event as NostrEvent, EventTemplate } from 'nostr-tools/core';
import { z } from 'zod';
import { MAX_NOSTR_ENCRYPTED_SHARE_HEX_LENGTH } from '$lib/crypto/recovery-v3';

export const RECOVERY_CAPSULE_VERSION = 2 as const;
export const KEYFATE_CAPSULE_KIND = 21060;
export const KEYFATE_MANIFEST_KIND = 21061;

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const nostrEventSchema = z
	.object({
		id: hex64,
		pubkey: hex64,
		created_at: z.number().int().nonnegative(),
		kind: z.number().int().nonnegative(),
		tags: z.array(z.array(z.string())),
		content: z.string(),
		sig: z.string().regex(/^[0-9a-f]{128}$/)
	})
	.strict();
const boundedHex = z
	.string()
	.min(2)
	.max(MAX_NOSTR_ENCRYPTED_SHARE_HEX_LENGTH)
	.regex(/^(?:[0-9a-f]{2})+$/);

export const recoveryCapsuleContentSchema = z
	.object({
		version: z.literal(RECOVERY_CAPSULE_VERSION),
		secretId: z.string().uuid(),
		recipientId: z.string().uuid(),
		recipientNostrPubkey: hex64,
		shareIndex: z.number().int().min(1).max(7),
		threshold: z.number().int().min(2).max(7),
		totalShares: z.number().int().min(3).max(7),
		encryptedShareHex: boundedHex,
		nonceHex: z.string().regex(/^[0-9a-f]{24}$/),
		encryptedKNostr: z.string().min(1).max(4096)
	})
	.strict()
	.refine((value) => value.threshold <= value.totalShares, {
		message: 'Threshold exceeds total shares'
	})
	.refine((value) => value.shareIndex <= value.totalShares, {
		message: 'Share index exceeds total shares'
	});

export type RecoveryCapsuleContent = z.infer<typeof recoveryCapsuleContentSchema>;

export const recoveryManifestContentSchema = z
	.object({
		version: z.literal(RECOVERY_CAPSULE_VERSION),
		secretId: z.string().uuid(),
		recipientId: z.string().uuid(),
		recipientNostrPubkey: hex64,
		publisherPubkey: hex64,
		giftWrapEventId: hex64,
		capsuleEventId: hex64
	})
	.strict();

export type RecoveryManifestContent = z.infer<typeof recoveryManifestContentSchema>;

function exactTags(event: NostrEvent, expected: string[][]): boolean {
	return JSON.stringify(event.tags) === JSON.stringify(expected);
}

export function createRecoveryCapsule(
	content: RecoveryCapsuleContent,
	publisherSecretKey: Uint8Array
): NostrEvent {
	const parsed = recoveryCapsuleContentSchema.parse(content);
	const template: EventTemplate = {
		kind: KEYFATE_CAPSULE_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['p', parsed.recipientNostrPubkey],
			['d', `${parsed.secretId}:${parsed.recipientId}`]
		],
		content: JSON.stringify(parsed)
	};
	return finalizeEvent(template, publisherSecretKey) as NostrEvent;
}

export function createRecoveryManifest(
	content: RecoveryManifestContent,
	publisherSecretKey: Uint8Array
): NostrEvent {
	const parsed = recoveryManifestContentSchema.parse(content);
	const template: EventTemplate = {
		kind: KEYFATE_MANIFEST_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [],
		content: JSON.stringify(parsed)
	};
	return finalizeEvent(template, publisherSecretKey) as NostrEvent;
}

export function parseVerifiedCapsule(
	event: NostrEvent,
	expectedPublisher: string,
	expectedRecipient: string
): RecoveryCapsuleContent {
	if (!verifyEvent(event) || event.id !== getEventHash(event)) {
		throw new Error('Invalid recovery capsule signature');
	}
	if (event.kind !== KEYFATE_CAPSULE_KIND) throw new Error('Invalid recovery capsule kind');
	if (event.pubkey !== expectedPublisher) throw new Error('Unexpected recovery capsule publisher');

	const content = recoveryCapsuleContentSchema.parse(JSON.parse(event.content));
	if (content.recipientNostrPubkey !== expectedRecipient) {
		throw new Error('Recovery capsule recipient mismatch');
	}
	if (
		!exactTags(event, [
			['p', expectedRecipient],
			['d', `${content.secretId}:${content.recipientId}`]
		])
	) {
		throw new Error('Invalid recovery capsule tags');
	}
	return content;
}

export function parseNostrEvent(input: unknown): NostrEvent {
	return nostrEventSchema.parse(input) as NostrEvent;
}

export function parseVerifiedManifestJson(serialized: string): {
	event: NostrEvent;
	content: RecoveryManifestContent;
} {
	const event = nostrEventSchema.parse(JSON.parse(serialized)) as NostrEvent;
	return { event, content: parseVerifiedManifest(event) };
}

export function parseVerifiedManifest(event: NostrEvent): RecoveryManifestContent {
	if (!verifyEvent(event) || event.id !== getEventHash(event)) {
		throw new Error('Invalid recovery manifest signature');
	}
	if (event.kind !== KEYFATE_MANIFEST_KIND || event.tags.length !== 0) {
		throw new Error('Invalid recovery manifest event');
	}
	const content = recoveryManifestContentSchema.parse(JSON.parse(event.content));
	if (content.publisherPubkey !== event.pubkey) {
		throw new Error('Recovery manifest publisher mismatch');
	}
	return content;
}
