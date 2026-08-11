import { hex } from '@scure/base';
import { z } from 'zod';
import type { Event as NostrEvent, UnsignedEvent } from 'nostr-tools/core';
import { finalizeEvent, getEventHash, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { getConversationKey, decrypt as nip44Decrypt } from './encryption';
import { KEYFATE_SHARE_KIND, createGiftWrap, createSeal, type Rumor } from './gift-wrap';
import { KEYFATE_CAPSULE_KIND, KEYFATE_MANIFEST_KIND } from './recovery-capsule';
import {
	RECOVERY_V3_SCHEME,
	parseRecoveryShareEnvelope,
	validateRecoveryShareEnvelopeContext
} from '$lib/crypto/recovery-v3';
import { decryptShare } from '$lib/crypto/recovery';

export const NOSTR_RECOVERY_V3_VERSION = 3 as const;
export const NOSTR_SETUP_BUNDLE_FORMAT = 'keyfate-nostr-recipient-setup' as const;
export const MAX_NOSTR_SIGNED_EVENT_CONTENT_LENGTH = 262_144;

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const relayHintSchema = z
	.string()
	.url()
	.max(2048)
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === 'ws:' || protocol === 'wss:';
	}, 'Relay hints must use ws:// or wss://');
const signedEventSchema = z
	.object({
		id: hex64,
		pubkey: hex64,
		created_at: z.number().int().nonnegative(),
		kind: z.number().int().nonnegative(),
		tags: z.array(z.array(z.string())),
		content: z.string().max(MAX_NOSTR_SIGNED_EVENT_CONTENT_LENGTH),
		sig: z.string().regex(/^[0-9a-f]{128}$/)
	})
	.strict();
const rumorSchema = signedEventSchema.omit({ sig: true });

const recoveryBindingSchema = z
	.object({
		scheme: z.literal(RECOVERY_V3_SCHEME),
		version: z.literal(NOSTR_RECOVERY_V3_VERSION),
		secretId: z.string().uuid(),
		recipientId: z.string().uuid(),
		recipientNostrPubkey: hex64,
		publisherPubkey: hex64,
		setId: z.string().regex(/^[0-9a-f]{32}$/),
		threshold: z.literal(2),
		totalShares: z.number().int().min(3).max(7),
		shareIndex: z.literal(2),
		ciphertextDigestHex: hex64
	})
	.strict();

export const recoveryCapsuleV3ContentSchema = recoveryBindingSchema
	.extend({
		encryptedShareHex: z
			.string()
			.min(2)
			.max(131_072)
			.regex(/^(?:[0-9a-f]{2})+$/),
		nonceHex: z.string().regex(/^[0-9a-f]{24}$/),
		encryptedKNostr: z.string().min(1).max(4096)
	})
	.strict();
export type RecoveryCapsuleV3Content = z.infer<typeof recoveryCapsuleV3ContentSchema>;

export const recoveryManifestV3ContentSchema = recoveryBindingSchema
	.extend({
		giftWrapEventId: hex64,
		capsuleEventId: hex64,
		relayHints: z.array(relayHintSchema).min(1).max(10)
	})
	.strict();
export type RecoveryManifestV3Content = z.infer<typeof recoveryManifestV3ContentSchema>;

export const recoverySetupBundleV3Schema = z
	.object({
		format: z.literal(NOSTR_SETUP_BUNDLE_FORMAT),
		version: z.literal(NOSTR_RECOVERY_V3_VERSION),
		manifestEvent: signedEventSchema,
		relayHints: z.array(relayHintSchema).min(1).max(10)
	})
	.strict();
export type RecoverySetupBundleV3 = z.infer<typeof recoverySetupBundleV3Schema>;

const capsuleRumorV3Schema = recoveryBindingSchema.extend({ capsuleEventId: hex64 }).strict();

type RecoveryBinding = z.infer<typeof recoveryBindingSchema>;

function exact(value: unknown, expected: unknown): boolean {
	return JSON.stringify(value) === JSON.stringify(expected);
}

function decryptConversation(payload: string, privateKey: Uint8Array, publicKey: string): string {
	const conversationKey = getConversationKey(privateKey, publicKey);
	try {
		return nip44Decrypt(payload, conversationKey);
	} finally {
		conversationKey.fill(0);
	}
}

function bindingFromEnvelope(params: {
	secretId: string;
	recipientId: string;
	recipientNostrPubkey: string;
	publisherPubkey: string;
	shareEnvelope: string;
}): RecoveryBinding {
	const envelope = parseRecoveryShareEnvelope(params.shareEnvelope);
	validateRecoveryShareEnvelopeContext(params.shareEnvelope, {
		index: 2,
		threshold: 2,
		total: envelope.total
	});
	return recoveryBindingSchema.parse({
		scheme: RECOVERY_V3_SCHEME,
		version: NOSTR_RECOVERY_V3_VERSION,
		secretId: params.secretId,
		recipientId: params.recipientId,
		recipientNostrPubkey: params.recipientNostrPubkey,
		publisherPubkey: params.publisherPubkey,
		setId: envelope.setId,
		threshold: 2,
		totalShares: envelope.total,
		shareIndex: 2,
		ciphertextDigestHex: envelope.protectedSecret.ciphertextDigestHex
	});
}

export function createRecoveryCapsuleV3(
	content: RecoveryCapsuleV3Content,
	publisherSecretKey: Uint8Array
): NostrEvent {
	const parsed = recoveryCapsuleV3ContentSchema.parse(content);
	if (getPublicKey(publisherSecretKey) !== parsed.publisherPubkey) {
		throw new Error('V3 capsule publisher key mismatch');
	}
	return finalizeEvent(
		{
			kind: KEYFATE_CAPSULE_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				['p', parsed.recipientNostrPubkey],
				['d', `${parsed.secretId}:${parsed.recipientId}`],
				['s', parsed.setId]
			],
			content: JSON.stringify(parsed)
		},
		publisherSecretKey
	) as NostrEvent;
}

export function createRecoveryManifestV3(
	content: RecoveryManifestV3Content,
	publisherSecretKey: Uint8Array
): NostrEvent {
	const parsed = recoveryManifestV3ContentSchema.parse(content);
	if (getPublicKey(publisherSecretKey) !== parsed.publisherPubkey) {
		throw new Error('V3 manifest publisher key mismatch');
	}
	return finalizeEvent(
		{
			kind: KEYFATE_MANIFEST_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				['p', parsed.recipientNostrPubkey],
				['e', parsed.giftWrapEventId],
				['d', `${parsed.secretId}:${parsed.recipientId}`],
				['s', parsed.setId]
			],
			content: JSON.stringify(parsed)
		},
		publisherSecretKey
	) as NostrEvent;
}

function createCapsuleRumorV3(capsule: NostrEvent, binding: RecoveryBinding): Rumor {
	if (capsule.pubkey !== binding.publisherPubkey) {
		throw new Error('V3 capsule publisher does not match rumor publisher');
	}
	const content = {
		version: NOSTR_RECOVERY_V3_VERSION,
		binding: capsuleRumorV3Schema.parse({ ...binding, capsuleEventId: capsule.id }),
		capsule
	};
	const rumor: UnsignedEvent = {
		kind: KEYFATE_SHARE_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['p', binding.recipientNostrPubkey],
			['e', capsule.id],
			['s', binding.setId]
		],
		content: JSON.stringify(content),
		pubkey: binding.publisherPubkey
	};
	return { ...rumor, id: getEventHash(rumor) };
}

export function createGiftWrapV3(
	capsule: NostrEvent,
	binding: RecoveryBinding,
	publisherSecretKey: Uint8Array
): NostrEvent {
	const rumor = createCapsuleRumorV3(capsule, binding);
	const seal = createSeal(rumor, publisherSecretKey, binding.recipientNostrPubkey);
	return createGiftWrap(seal, binding.recipientNostrPubkey);
}

export function parseVerifiedCapsuleV3(
	event: NostrEvent,
	expected: RecoveryManifestV3Content
): RecoveryCapsuleV3Content {
	const parsedEvent = signedEventSchema.parse(event) as NostrEvent;
	if (!verifyEvent(parsedEvent) || parsedEvent.id !== getEventHash(parsedEvent)) {
		throw new Error('Invalid v3 recovery capsule signature');
	}
	if (
		parsedEvent.id !== expected.capsuleEventId ||
		parsedEvent.kind !== KEYFATE_CAPSULE_KIND ||
		parsedEvent.pubkey !== expected.publisherPubkey
	) {
		throw new Error('Invalid v3 recovery capsule event binding');
	}
	const content = recoveryCapsuleV3ContentSchema.parse(JSON.parse(parsedEvent.content));
	const expectedBinding = { ...expected };
	delete (expectedBinding as Partial<RecoveryManifestV3Content>).giftWrapEventId;
	delete (expectedBinding as Partial<RecoveryManifestV3Content>).capsuleEventId;
	delete (expectedBinding as Partial<RecoveryManifestV3Content>).relayHints;
	const actualBinding = Object.fromEntries(
		Object.keys(expectedBinding).map((key) => [key, content[key as keyof typeof content]])
	);
	if (!exact(actualBinding, expectedBinding)) throw new Error('V3 capsule context mismatch');
	if (
		!exact(parsedEvent.tags, [
			['p', expected.recipientNostrPubkey],
			['d', `${expected.secretId}:${expected.recipientId}`],
			['s', expected.setId]
		])
	) {
		throw new Error('Invalid v3 capsule tags');
	}
	return content;
}

export function verifyOuterGiftWrapV3(
	event: NostrEvent,
	expected: RecoveryManifestV3Content
): void {
	const parsedEvent = signedEventSchema.parse(event) as NostrEvent;
	if (!verifyEvent(parsedEvent) || parsedEvent.id !== getEventHash(parsedEvent)) {
		throw new Error('Invalid v3 gift wrap signature');
	}
	if (
		parsedEvent.id !== expected.giftWrapEventId ||
		parsedEvent.kind !== 1059 ||
		!exact(parsedEvent.tags, [['p', expected.recipientNostrPubkey]])
	) {
		throw new Error('Invalid v3 gift wrap binding');
	}
}

export function parseVerifiedManifestV3(event: NostrEvent): RecoveryManifestV3Content {
	const parsedEvent = signedEventSchema.parse(event) as NostrEvent;
	if (!verifyEvent(parsedEvent) || parsedEvent.id !== getEventHash(parsedEvent)) {
		throw new Error('Invalid v3 recovery manifest signature');
	}
	if (parsedEvent.kind !== KEYFATE_MANIFEST_KIND) throw new Error('Invalid v3 manifest kind');
	const content = recoveryManifestV3ContentSchema.parse(JSON.parse(parsedEvent.content));
	if (content.publisherPubkey !== parsedEvent.pubkey)
		throw new Error('V3 manifest publisher mismatch');
	if (
		!exact(parsedEvent.tags, [
			['p', content.recipientNostrPubkey],
			['e', content.giftWrapEventId],
			['d', `${content.secretId}:${content.recipientId}`],
			['s', content.setId]
		])
	) {
		throw new Error('Invalid v3 manifest tags');
	}
	return content;
}

export function parseRecoverySetupBundleV3(input: string | unknown): {
	bundle: RecoverySetupBundleV3;
	manifest: RecoveryManifestV3Content;
} {
	let value: unknown = input;
	if (typeof input === 'string') {
		if (input.length > 300_000) throw new Error('V3 setup bundle exceeds maximum size');
		try {
			value = JSON.parse(input);
		} catch (error) {
			throw new Error('Invalid v3 setup bundle JSON', { cause: error });
		}
	}
	const bundle = recoverySetupBundleV3Schema.parse(value);
	const manifest = parseVerifiedManifestV3(bundle.manifestEvent as NostrEvent);
	if (!exact(bundle.relayHints, manifest.relayHints)) {
		throw new Error('V3 setup bundle relay hints do not match the signed manifest');
	}
	return { bundle, manifest };
}

export function serializeRecoverySetupBundleV3(bundle: RecoverySetupBundleV3): string {
	const { bundle: parsed } = parseRecoverySetupBundleV3(bundle);
	return JSON.stringify(parsed, null, 2);
}

export function createRecoveryArtifactV3(params: {
	secretId: string;
	recipientId: string;
	recipientNostrPubkey: string;
	shareEnvelope: string;
	encryptedShareHex: string;
	nonceHex: string;
	encryptedKNostr: string;
	publisherSecretKey: Uint8Array;
	relayHints: string[];
}): {
	binding: RecoveryBinding;
	capsuleEvent: NostrEvent;
	giftWrapEvent: NostrEvent;
	manifestEvent: NostrEvent;
	setupBundle: RecoverySetupBundleV3;
} {
	const publisherPubkey = getPublicKey(params.publisherSecretKey);
	const binding = bindingFromEnvelope({ ...params, publisherPubkey });
	const capsuleEvent = createRecoveryCapsuleV3(
		{
			...binding,
			encryptedShareHex: params.encryptedShareHex,
			nonceHex: params.nonceHex,
			encryptedKNostr: params.encryptedKNostr
		},
		params.publisherSecretKey
	);
	const giftWrapEvent = createGiftWrapV3(capsuleEvent, binding, params.publisherSecretKey);
	const manifestEvent = createRecoveryManifestV3(
		{
			...binding,
			capsuleEventId: capsuleEvent.id,
			giftWrapEventId: giftWrapEvent.id,
			relayHints: params.relayHints
		},
		params.publisherSecretKey
	);
	const setupBundle = recoverySetupBundleV3Schema.parse({
		format: NOSTR_SETUP_BUNDLE_FORMAT,
		version: NOSTR_RECOVERY_V3_VERSION,
		manifestEvent,
		relayHints: params.relayHints
	});
	return { binding, capsuleEvent, giftWrapEvent, manifestEvent, setupBundle };
}

/** Verify the pinned full chain and return one strict authenticated v3 share envelope. */
export function unwrapRecoveryArtifactV3(params: {
	giftWrapEvent: NostrEvent;
	recipientSecretKey: Uint8Array;
	setupBundle: string | RecoverySetupBundleV3;
}): string {
	const { manifest } = parseRecoverySetupBundleV3(params.setupBundle);
	const recipientPubkey = getPublicKey(params.recipientSecretKey);
	if (recipientPubkey !== manifest.recipientNostrPubkey)
		throw new Error('Setup bundle recipient mismatch');
	const giftWrap = signedEventSchema.parse(params.giftWrapEvent) as NostrEvent;
	if (
		!verifyEvent(giftWrap) ||
		giftWrap.id !== getEventHash(giftWrap) ||
		giftWrap.id !== manifest.giftWrapEventId ||
		giftWrap.kind !== 1059 ||
		!exact(giftWrap.tags, [['p', recipientPubkey]])
	)
		throw new Error('Invalid v3 gift wrap');
	const seal = signedEventSchema.parse(
		JSON.parse(decryptConversation(giftWrap.content, params.recipientSecretKey, giftWrap.pubkey))
	) as NostrEvent;
	if (
		!verifyEvent(seal) ||
		seal.id !== getEventHash(seal) ||
		seal.kind !== 13 ||
		seal.tags.length !== 0 ||
		seal.pubkey !== manifest.publisherPubkey
	)
		throw new Error('Invalid v3 seal');
	const rumor = rumorSchema.parse(
		JSON.parse(decryptConversation(seal.content, params.recipientSecretKey, seal.pubkey))
	);
	if (
		rumor.id !== getEventHash(rumor) ||
		rumor.kind !== KEYFATE_SHARE_KIND ||
		rumor.pubkey !== manifest.publisherPubkey
	)
		throw new Error('Invalid v3 rumor');
	const rumorEnvelope = z
		.object({
			version: z.literal(NOSTR_RECOVERY_V3_VERSION),
			binding: capsuleRumorV3Schema,
			capsule: signedEventSchema
		})
		.strict()
		.parse(JSON.parse(rumor.content));
	const expectedBinding = { ...manifest };
	delete (expectedBinding as Partial<RecoveryManifestV3Content>).giftWrapEventId;
	delete (expectedBinding as Partial<RecoveryManifestV3Content>).capsuleEventId;
	delete (expectedBinding as Partial<RecoveryManifestV3Content>).relayHints;
	if (
		!exact(rumorEnvelope.binding, { ...expectedBinding, capsuleEventId: manifest.capsuleEventId })
	)
		throw new Error('V3 rumor context mismatch');
	if (
		!exact(rumor.tags, [
			['p', recipientPubkey],
			['e', manifest.capsuleEventId],
			['s', manifest.setId]
		])
	)
		throw new Error('Invalid v3 rumor tags');
	const capsuleEvent = rumorEnvelope.capsule as NostrEvent;
	const capsule = parseVerifiedCapsuleV3(capsuleEvent, manifest);
	const encryptedKeyHex = decryptConversation(
		capsule.encryptedKNostr,
		params.recipientSecretKey,
		manifest.publisherPubkey
	);
	if (!/^[0-9a-f]{64}$/.test(encryptedKeyHex))
		throw new Error('Recovered v3 transport key is not 32 bytes');
	const key = hex.decode(encryptedKeyHex);
	try {
		const shareEnvelope = decryptShare(
			hex.decode(capsule.encryptedShareHex),
			hex.decode(capsule.nonceHex),
			key
		);
		const parsedShare = validateRecoveryShareEnvelopeContext(shareEnvelope, {
			index: 2,
			threshold: 2,
			total: manifest.totalShares
		});
		if (
			parsedShare.setId !== manifest.setId ||
			parsedShare.protectedSecret.ciphertextDigestHex !== manifest.ciphertextDigestHex
		)
			throw new Error('Recovered v3 share binding mismatch');
		return shareEnvelope;
	} finally {
		key.fill(0);
	}
}
