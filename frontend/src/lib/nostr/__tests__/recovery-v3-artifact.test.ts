import { describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	assertRecoveryEnvelopeFitsNostrCapsule,
	createAuthenticatedRecoverySet,
	MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES,
	recoverAuthenticatedSecret
} from '$lib/crypto/recovery-v3';
import { publishSharesToNostr } from '$lib/services/nostr-publisher';
import {
	MAX_NOSTR_SIGNED_EVENT_CONTENT_LENGTH,
	parseRecoverySetupBundleV3,
	unwrapRecoveryArtifactV3
} from '$lib/nostr/recovery-v3-artifact';

const secretId = '11111111-1111-4111-8111-111111111111';
const recipientIds = [
	'22222222-2222-4222-8222-222222222222',
	'33333333-3333-4333-8333-333333333333'
];

function clone<T>(value: T): T {
	return structuredClone(value);
}

describe('anchored Nostr recovery v3', () => {
	it('preflights the complete nested gift-wrap padding boundary before persistence', async () => {
		const safe = createAuthenticatedRecoverySet('x'.repeat(25_670), { threshold: 2, total: 3 });
		expect(new TextEncoder().encode(safe.envelopes[1])).toHaveLength(
			MAX_NOSTR_V3_RECOVERY_ENVELOPE_BYTES
		);
		expect(() => assertRecoveryEnvelopeFitsNostrCapsule(safe.envelopes[1])).not.toThrow();
		const recipientKey = generateSecretKey();
		const senderKey = generateSecretKey();
		const result = await publishSharesToNostr({
			secretId,
			shares: [{ recipientId: recipientIds[0], share: safe.envelopes[1], shareIndex: 2 }],
			recipients: [{ id: recipientIds[0], nostrPubkey: getPublicKey(recipientKey) }],
			senderSecretKey: senderKey,
			threshold: 2,
			totalShares: 3,
			relays: ['wss://relay.example'],
			client: { publish: async () => undefined, close: () => undefined }
		});
		expect(result.published[0].giftWrapEvent.content.length).toBeLessThanOrEqual(
			MAX_NOSTR_SIGNED_EVENT_CONTENT_LENGTH
		);
		result.published[0].plaintextK.fill(0);
		recipientKey.fill(0);
		expect([...senderKey]).toEqual(Array(32).fill(0));

		const reproducedOversize = createAuthenticatedRecoverySet('x'.repeat(30_000), {
			threshold: 2,
			total: 3
		});
		expect(() => assertRecoveryEnvelopeFitsNostrCapsule(reproducedOversize.envelopes[1])).toThrow(
			'safe nested Nostr gift-wrap limit'
		);
	});

	it('round-trips the same logical recipient envelope through separately encrypted artifacts', async () => {
		const set = createAuthenticatedRecoverySet('anchored secret', { threshold: 2, total: 3 });
		const recipientKeys = [generateSecretKey(), generateSecretKey()];
		const senderKey = generateSecretKey();
		const publishedEvents: string[] = [];
		const result = await publishSharesToNostr({
			secretId,
			shares: recipientIds.map((recipientId) => ({
				recipientId,
				share: set.envelopes[1],
				shareIndex: 2
			})),
			recipients: recipientIds.map((id, index) => ({
				id,
				nostrPubkey: getPublicKey(recipientKeys[index])
			})),
			senderSecretKey: senderKey,
			threshold: 2,
			totalShares: 3,
			relays: ['wss://relay.example'],
			client: {
				publish: async (event) => {
					publishedEvents.push(event.id);
				},
				close: () => undefined
			}
		});
		expect(result.errors).toEqual([]);
		expect(result.published).toHaveLength(2);
		expect(publishedEvents).toHaveLength(2);
		expect(result.published[0].capsuleEvent.content).not.toBe(
			result.published[1].capsuleEvent.content
		);
		for (let index = 0; index < 2; index++) {
			const share = unwrapRecoveryArtifactV3({
				giftWrapEvent: result.published[index].giftWrapEvent,
				recipientSecretKey: recipientKeys[index],
				setupBundle: result.published[index].setupBundle
			});
			expect(share).toBe(set.envelopes[1]);
			expect(recoverAuthenticatedSecret([set.envelopes[0], share])).toBe('anchored secret');
			recipientKeys[index].fill(0);
			result.published[index].plaintextK.fill(0);
		}
		expect([...senderKey]).toEqual(Array(32).fill(0));
	});

	it('rejects missing, substituted, and binding-mutated trust anchors', async () => {
		const set = createAuthenticatedRecoverySet('reject substitution', { threshold: 2, total: 3 });
		const recipientKey = generateSecretKey();
		const result = await publishSharesToNostr({
			secretId,
			shares: [{ recipientId: recipientIds[0], share: set.envelopes[1], shareIndex: 2 }],
			recipients: [{ id: recipientIds[0], nostrPubkey: getPublicKey(recipientKey) }],
			senderSecretKey: generateSecretKey(),
			threshold: 2,
			totalShares: 3,
			relays: ['wss://relay.example'],
			client: { publish: async () => undefined, close: () => undefined }
		});
		const artifact = result.published[0];
		expect(() => parseRecoverySetupBundleV3('')).toThrow();
		const changedRelay = clone(artifact.setupBundle);
		changedRelay.relayHints = ['wss://attacker.example'];
		expect(() => parseRecoverySetupBundleV3(changedRelay)).toThrow();
		const replaced = clone(artifact.setupBundle);
		replaced.manifestEvent.pubkey = '0'.repeat(64);
		expect(() =>
			unwrapRecoveryArtifactV3({
				giftWrapEvent: artifact.giftWrapEvent,
				recipientSecretKey: recipientKey,
				setupBundle: replaced
			})
		).toThrow();
		const wrongEvent = clone(artifact.giftWrapEvent);
		wrongEvent.id = '0'.repeat(64);
		expect(() =>
			unwrapRecoveryArtifactV3({
				giftWrapEvent: wrongEvent,
				recipientSecretKey: recipientKey,
				setupBundle: artifact.setupBundle
			})
		).toThrow();
		artifact.plaintextK.fill(0);
		recipientKey.fill(0);
	});

	it('rejects non-WebSocket relay hints before any network effect', async () => {
		const set = createAuthenticatedRecoverySet('relay protocol', { threshold: 2, total: 3 });
		const recipientKey = generateSecretKey();
		const senderKey = generateSecretKey();
		let calls = 0;
		await expect(
			publishSharesToNostr({
				secretId,
				shares: [{ recipientId: recipientIds[0], share: set.envelopes[1], shareIndex: 2 }],
				recipients: [{ id: recipientIds[0], nostrPubkey: getPublicKey(recipientKey) }],
				senderSecretKey: senderKey,
				threshold: 2,
				totalShares: 3,
				relays: ['https://not-a-nostr-relay.example'],
				client: {
					publish: async () => {
						calls++;
					},
					close: () => undefined
				}
			})
		).rejects.toThrow('Relay hints must use');
		expect(calls).toBe(0);
		expect([...senderKey]).toEqual(Array(32).fill(0));
		recipientKey.fill(0);
	});

	it('retains every signed artifact when one relay publication fails', async () => {
		const set = createAuthenticatedRecoverySet('retryable', { threshold: 2, total: 3 });
		const keys = [generateSecretKey(), generateSecretKey()];
		let calls = 0;
		const result = await publishSharesToNostr({
			secretId,
			shares: recipientIds.map((recipientId) => ({
				recipientId,
				share: set.envelopes[1],
				shareIndex: 2
			})),
			recipients: recipientIds.map((id, index) => ({ id, nostrPubkey: getPublicKey(keys[index]) })),
			senderSecretKey: generateSecretKey(),
			threshold: 2,
			totalShares: 3,
			relays: ['wss://relay.example'],
			client: {
				publish: async () => {
					calls++;
					if (calls === 2) throw new Error('relay unavailable');
				},
				close: () => undefined
			}
		});
		expect(result.published).toHaveLength(2);
		expect(result.published.map((artifact) => artifact.relayPublished)).toEqual([true, false]);
		expect(result.errors).toEqual([{ recipientId: recipientIds[1], error: 'relay unavailable' }]);
		for (const artifact of result.published) artifact.plaintextK.fill(0);
		for (const key of keys) key.fill(0);
	});
});
