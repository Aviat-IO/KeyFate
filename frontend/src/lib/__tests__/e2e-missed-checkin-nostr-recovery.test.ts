/**
 * @vitest-environment node
 *
 * Issue #8 integration harness:
 * missed check-in -> Nostr gift-wrap broadcast -> recipient relay recovery.
 *
 * Uses real crypto and an in-memory relay/client shim. No production relay I/O.
 */

import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'buffer';
import sss from 'shamirs-secret-sharing';
import type { Event as NostrEvent } from 'nostr-tools/core';
import { hex } from '@scure/base';

import { generateKeypair } from '$lib/nostr/keypair';
import { recoverKFromNostr, decryptShare } from '$lib/crypto/recovery';
import { unwrapGiftWrap } from '$lib/crypto/recovery-flows';

type RelayFilter = {
	ids?: string[];
	kinds?: number[];
	'#p'?: string[];
};

class InMemoryNostrRelay {
	private events: NostrEvent[] = [];

	createClient() {
		return {
			publish: async (event: NostrEvent): Promise<void> => {
				this.events.push(event);
			},
			query: async (filter: RelayFilter): Promise<NostrEvent[]> => this.query(filter),
			get: async (filter: RelayFilter): Promise<NostrEvent | null> => this.query(filter)[0] ?? null,
			close: (): void => {}
		};
	}

	query(filter: RelayFilter): NostrEvent[] {
		return this.events.filter((event) => {
			if (filter.ids && !filter.ids.includes(event.id)) return false;
			if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
			if (filter['#p']) {
				const pTags = event.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]);
				if (!filter['#p'].some((pubkey) => pTags.includes(pubkey))) return false;
			}
			return true;
		});
	}
}

const relayState = vi.hoisted(() => ({
	relay: null as InMemoryNostrRelay | null
}));

vi.mock('$lib/nostr/client', () => ({
	createNostrClient: () => {
		if (!relayState.relay) {
			throw new Error('test relay not initialized');
		}
		return relayState.relay.createClient();
	}
}));

import { publishSharesToNostr } from '$lib/services/nostr-publisher';

function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
	expect(Array.from(actual)).toEqual(Array.from(expected));
}

describe('Issue #8 E2E: missed check-in to Nostr recipient recovery', () => {
	it('broadcasts encrypted shares after a missed check-in and reconstructs from recipient relay data', async () => {
		relayState.relay = new InMemoryNostrRelay();

		// Create secret with Nostr backup enabled.
		const now = new Date('2026-05-03T12:00:00.000Z');
		const secretRecord = {
			id: 'issue-8-secret',
			title: 'issue 8 recovery fixture',
			enableNostrShares: true,
			nextCheckInAt: new Date(now.getTime() - 60_000),
			gracePeriodHours: 0,
			threshold: 2,
			totalShares: 3
		};

		const originalSecret = Buffer.from(
			'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
			'utf8'
		);
		const [ownerBackupShare, keyfateDisclosureShare, recipientShare] = sss.split(originalSecret, {
			shares: secretRecord.totalShares,
			threshold: secretRecord.threshold
		});
		void ownerBackupShare;

		expect(Buffer.from(sss.combine([keyfateDisclosureShare, recipientShare])).toString('utf8')).toBe(
			originalSecret.toString('utf8')
		);

		const serverNostr = generateKeypair();
		const recipientNostr = generateKeypair();
		const recipientId = 'recipient-1';

		// Simulate missed check-in scheduler deciding disclosure is due.
		const disclosureDue =
			secretRecord.enableNostrShares &&
			now.getTime() >=
				secretRecord.nextCheckInAt.getTime() + secretRecord.gracePeriodHours * 60 * 60 * 1000;
		expect(disclosureDue).toBe(true);

		// Trigger disclosure broadcast to relays.
		const publishResult = await publishSharesToNostr({
			secretId: secretRecord.id,
			shares: [
				{
					recipientId,
					share: Buffer.from(recipientShare).toString('base64'),
					shareIndex: 3
				}
			],
			recipients: [{ id: recipientId, nostrPubkey: recipientNostr.publicKey }],
			senderSecretKey: serverNostr.secretKey,
			threshold: secretRecord.threshold,
			totalShares: secretRecord.totalShares
		});

		expect(publishResult.errors).toEqual([]);
		expect(publishResult.skipped).toEqual([]);
		expect(publishResult.published).toHaveLength(1);

		// Recipient fetches their gift wrap from relay by p-tag.
		const foundGiftWraps = relayState.relay.query({ kinds: [1059], '#p': [recipientNostr.publicKey] });
		expect(foundGiftWraps).toHaveLength(1);
		expect(foundGiftWraps[0].id).toBe(publishResult.published[0].nostrEventId);

		// Recipient unwraps gift wrap, recovers K via Nostr, decrypts their share.
		const unwrapped = unwrapGiftWrap(foundGiftWraps[0], recipientNostr.secretKey);
		expect(unwrapped.secretId).toBe(secretRecord.id);
		expect(unwrapped.shareIndex).toBe(3);
		expect(unwrapped.threshold).toBe(secretRecord.threshold);

		const encryptedSharePayload = JSON.parse(unwrapped.share) as {
			encryptedShare: string;
			nonce: string;
			encryptedKNostr: string;
		};
		const recoveredK = await recoverKFromNostr(
			encryptedSharePayload.encryptedKNostr,
			recipientNostr.secretKey,
			serverNostr.publicKey
		);
		expectBytesEqual(recoveredK, publishResult.published[0].plaintextK);

		const recoveredRecipientShare = Buffer.from(
			decryptShare(
				hex.decode(encryptedSharePayload.encryptedShare),
				hex.decode(encryptedSharePayload.nonce),
				recoveredK
			),
			'base64'
		);
		expect(Array.from(recoveredRecipientShare)).toEqual(Array.from(recipientShare));

		// Recipient combines relay-recovered share with KeyFate's disclosed share.
		const reconstructed = sss.combine([
			Buffer.from(keyfateDisclosureShare),
			Buffer.from(recoveredRecipientShare)
		]);
		expect(Buffer.from(reconstructed).toString('utf8')).toBe(originalSecret.toString('utf8'));
	});
});
