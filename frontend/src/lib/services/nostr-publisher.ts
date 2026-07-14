/**
 * Nostr share publishing service.
 *
 * Publishes double-encrypted Shamir shares to Nostr relays via NIP-59 gift wraps.
 * Each recipient with a nostrPubkey gets their share delivered as a gift-wrapped event.
 */

import { hex } from '@scure/base';
import { doubleEncryptShare } from '$lib/crypto/double-encrypt';
import { getConversationKey, encrypt, decrypt as nip44Decrypt } from '$lib/nostr/encryption';
import { wrapCapsuleForRecipient } from '$lib/nostr/gift-wrap';
import {
	createRecoveryCapsule,
	createRecoveryManifest,
	RECOVERY_CAPSULE_VERSION
} from '$lib/nostr/recovery-capsule';
import { createNostrClient } from '$lib/nostr/client';
import type { Nip44Ops } from '$lib/crypto/double-encrypt';
import { getPublicKey } from 'nostr-tools/pure';
import type { Event as NostrEvent } from 'nostr-tools/core';

/** Input for a single share to publish */
export interface ShareInput {
	recipientId: string;
	share: string;
	shareIndex: number;
}

/** Result for a single published share */
export interface PublishedShare {
	recipientId: string;
	nostrEventId: string;
	capsuleEventId: string;
	publisherPubkey: string;
	giftWrapEvent: NostrEvent;
	capsuleEvent: NostrEvent;
	manifestEvent: NostrEvent;
	/** Plaintext symmetric key K (for OP_RETURN embedding) */
	plaintextK: Uint8Array;
	/** K encrypted with passphrase-derived key (if passphrase was provided) */
	encryptedKPassphrase?: {
		ciphertext: Uint8Array;
		nonce: Uint8Array;
		salt: Uint8Array;
	};
}

/** Result of publishing shares to Nostr */
export interface PublishResult {
	published: PublishedShare[];
	/** Recipients that were skipped (no nostrPubkey) */
	skipped: string[];
	errors: Array<{ recipientId: string; error: string }>;
}

/** Recipient info needed for publishing */
export interface RecipientInfo {
	id: string;
	nostrPubkey: string | null;
}

/**
 * Create real NIP-44 operations that use the conversation key approach.
 */
function createNip44Ops(): Nip44Ops {
	return {
		encrypt(plaintext: string, senderPrivkey: Uint8Array, recipientPubkey: string): string {
			const convKey = getConversationKey(senderPrivkey, recipientPubkey);
			return encrypt(plaintext, convKey);
		},
		decrypt(ciphertext: string, recipientPrivkey: Uint8Array, senderPubkey: string): string {
			const convKey = getConversationKey(recipientPrivkey, senderPubkey);
			return nip44Decrypt(ciphertext, convKey);
		}
	};
}

export interface NostrPublisherClient {
	publish(event: NostrEvent): Promise<void>;
	close(): void;
}

/**
 * Publish encrypted shares to Nostr relays for recipients that have a nostrPubkey.
 *
 * For each eligible recipient:
 *   1. Double-encrypt the share (ChaCha20 + NIP-44)
 *   2. Create a NIP-59 Gift Wrap event
 *   3. Publish to Nostr relays
 *
 * @param secretId - The secret's UUID
 * @param shares - Array of shares with recipient IDs
 * @param recipients - Recipient info (must include nostrPubkey)
 * @param senderSecretKey - The sender's Nostr secret key (32 bytes)
 * @param threshold - SSS threshold
 * @param totalShares - SSS total shares
 * @param passphrase - Optional passphrase for third recovery path
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
	const {
		secretId,
		shares,
		recipients,
		senderSecretKey,
		threshold,
		totalShares,
		passphrase,
		relays,
		client: providedClient
	} = params;

	const result: PublishResult = {
		published: [],
		skipped: [],
		errors: []
	};
	const publisherPubkey = getPublicKey(senderSecretKey);

	// Build a lookup of recipient ID -> nostrPubkey
	const recipientMap = new Map<string, string>();
	for (const r of recipients) {
		if (r.nostrPubkey) {
			recipientMap.set(r.id, r.nostrPubkey);
		}
	}

	const nip44Ops = createNip44Ops();
	const client = providedClient ?? createNostrClient(relays ? { relays } : undefined);

	try {
		for (const shareInput of shares) {
			const nostrPubkey = recipientMap.get(shareInput.recipientId);
			if (!nostrPubkey) {
				result.skipped.push(shareInput.recipientId);
				continue;
			}

			try {
				// 1. Double-encrypt the share
				const encrypted = await doubleEncryptShare(
					shareInput.share,
					nostrPubkey,
					senderSecretKey,
					passphrase,
					nip44Ops
				);

				// 2. Encode the encrypted share as hex for the gift wrap payload
				const encryptedShareHex = hex.encode(encrypted.encryptedShare);
				const nonceHex = hex.encode(encrypted.nonce);

				const capsule = createRecoveryCapsule(
					{
						version: RECOVERY_CAPSULE_VERSION,
						secretId,
						recipientId: shareInput.recipientId,
						recipientNostrPubkey: nostrPubkey,
						shareIndex: shareInput.shareIndex,
						threshold,
						totalShares,
						encryptedShareHex,
						nonceHex,
						encryptedKNostr: encrypted.encryptedKNostr
					},
					senderSecretKey
				);

				// The signed capsule is embedded in the encrypted rumor. The service
				// and relays see only the already-signed outer event.
				const giftWrap = wrapCapsuleForRecipient(capsule, senderSecretKey, nostrPubkey);
				const manifestEvent = createRecoveryManifest(
					{
						version: RECOVERY_CAPSULE_VERSION,
						secretId,
						recipientId: shareInput.recipientId,
						recipientNostrPubkey: nostrPubkey,
						publisherPubkey,
						giftWrapEventId: giftWrap.id,
						capsuleEventId: capsule.id
					},
					senderSecretKey
				);

				await client.publish(giftWrap);

				result.published.push({
					recipientId: shareInput.recipientId,
					nostrEventId: giftWrap.id,
					capsuleEventId: capsule.id,
					publisherPubkey,
					giftWrapEvent: giftWrap,
					capsuleEvent: capsule,
					manifestEvent,
					plaintextK: encrypted.plaintextK,
					encryptedKPassphrase: encrypted.encryptedKPassphrase
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				result.errors.push({
					recipientId: shareInput.recipientId,
					error: message
				});
			}
		}
	} finally {
		client.close();
		// The per-secret publisher key is one-shot and never leaves the browser.
		senderSecretKey.fill(0);
	}

	return result;
}
