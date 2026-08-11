import { hex } from '@scure/base';
import { doubleEncryptShare, type Nip44Ops } from '$lib/crypto/double-encrypt';
import { getConversationKey, encrypt, decrypt as nip44Decrypt } from '$lib/nostr/encryption';
import {
	createRecoveryArtifactV3,
	type RecoverySetupBundleV3
} from '$lib/nostr/recovery-v3-artifact';
import { createNostrClient } from '$lib/nostr/client';
import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
import type { Event as NostrEvent } from 'nostr-tools/core';

export interface ShareInput {
	recipientId: string;
	share: string;
	shareIndex: number;
}

export interface PublishedShare {
	recipientId: string;
	nostrEventId: string;
	capsuleEventId: string;
	publisherPubkey: string;
	giftWrapEvent: NostrEvent;
	capsuleEvent: NostrEvent;
	manifestEvent: NostrEvent;
	setupBundle: RecoverySetupBundleV3;
	relayPublished: boolean;
	plaintextK: Uint8Array;
	encryptedKPassphrase?: {
		ciphertext: Uint8Array;
		nonce: Uint8Array;
		salt: Uint8Array;
	};
}

export interface PublishResult {
	/** All fully built, signed artifacts, including retryable relay failures. */
	published: PublishedShare[];
	skipped: string[];
	errors: Array<{ recipientId: string; error: string }>;
}

export interface RecipientInfo {
	id: string;
	nostrPubkey: string | null;
}

function createNip44Ops(): Nip44Ops {
	return {
		encrypt(plaintext: string, senderPrivkey: Uint8Array, recipientPubkey: string): string {
			const conversationKey = getConversationKey(senderPrivkey, recipientPubkey);
			try {
				return encrypt(plaintext, conversationKey);
			} finally {
				conversationKey.fill(0);
			}
		},
		decrypt(ciphertext: string, recipientPrivkey: Uint8Array, senderPubkey: string): string {
			const conversationKey = getConversationKey(recipientPrivkey, senderPubkey);
			try {
				return nip44Decrypt(ciphertext, conversationKey);
			} finally {
				conversationKey.fill(0);
			}
		}
	};
}

export interface NostrPublisherClient {
	publish(event: NostrEvent): Promise<void>;
	close(): void;
}

/**
 * Build every recipient-bound v3 artifact before any network effect, then publish.
 * Relay failures retain the exact signed artifacts for idempotent retry.
 */
export async function publishSharesToNostr(params: {
	secretId: string;
	shares: ShareInput[];
	recipients: RecipientInfo[];
	senderSecretKey: Uint8Array;
	threshold: number;
	totalShares: number;
	passphrase?: string;
	relays?: string[];
	client?: NostrPublisherClient;
}): Promise<PublishResult> {
	if (params.threshold !== 2) throw new Error('Authenticated Nostr v3 requires threshold 2');
	const relayHints = params.relays?.length ? [...params.relays] : [...DEFAULT_RELAYS];
	const recipientMap = new Map(
		params.recipients
			.filter((recipient): recipient is { id: string; nostrPubkey: string } =>
				Boolean(recipient.nostrPubkey)
			)
			.map((recipient) => [recipient.id, recipient.nostrPubkey])
	);
	const result: PublishResult = { published: [], skipped: [], errors: [] };
	const nip44Ops = createNip44Ops();

	try {
		// No relay call occurs until the complete recipient set is built successfully.
		for (const shareInput of params.shares) {
			const recipientNostrPubkey = recipientMap.get(shareInput.recipientId);
			if (!recipientNostrPubkey) {
				result.skipped.push(shareInput.recipientId);
				continue;
			}
			if (shareInput.shareIndex !== 2)
				throw new Error('V3 recipient share must have actual index 2');
			const encrypted = await doubleEncryptShare(
				shareInput.share,
				recipientNostrPubkey,
				params.senderSecretKey,
				params.passphrase,
				nip44Ops
			);
			try {
				const artifact = createRecoveryArtifactV3({
					secretId: params.secretId,
					recipientId: shareInput.recipientId,
					recipientNostrPubkey,
					shareEnvelope: shareInput.share,
					encryptedShareHex: hex.encode(encrypted.encryptedShare),
					nonceHex: hex.encode(encrypted.nonce),
					encryptedKNostr: encrypted.encryptedKNostr,
					publisherSecretKey: params.senderSecretKey,
					relayHints
				});
				result.published.push({
					recipientId: shareInput.recipientId,
					nostrEventId: artifact.giftWrapEvent.id,
					capsuleEventId: artifact.capsuleEvent.id,
					publisherPubkey: artifact.binding.publisherPubkey,
					giftWrapEvent: artifact.giftWrapEvent,
					capsuleEvent: artifact.capsuleEvent,
					manifestEvent: artifact.manifestEvent,
					setupBundle: artifact.setupBundle,
					relayPublished: false,
					plaintextK: encrypted.plaintextK,
					encryptedKPassphrase: encrypted.encryptedKPassphrase
				});
			} catch (error) {
				encrypted.plaintextK.fill(0);
				throw error;
			}
		}

		const client = params.client ?? createNostrClient({ relays: relayHints });
		try {
			for (const artifact of result.published) {
				try {
					await client.publish(artifact.giftWrapEvent);
					artifact.relayPublished = true;
				} catch (error) {
					result.errors.push({
						recipientId: artifact.recipientId,
						error: error instanceof Error ? error.message : 'Relay publication failed'
					});
				}
			}
		} finally {
			client.close();
		}
		return result;
	} catch (error) {
		for (const artifact of result.published) artifact.plaintextK.fill(0);
		result.published = [];
		throw error;
	} finally {
		params.senderSecretKey.fill(0);
	}
}
