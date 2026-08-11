import { afterEach, describe, expect, it } from 'vitest';
import { serve } from 'bun';
import type { Event as NostrEvent } from 'nostr-tools/core';
import type { Filter } from 'nostr-tools/filter';
import { generateKeypair } from '$lib/nostr/keypair';
import { NostrClient } from '$lib/nostr/client';
import { publishSharesToNostr } from '$lib/services/nostr-publisher';
import { unwrapRecoveryArtifactV3 } from '$lib/nostr/recovery-v3-artifact';
import {
	createAuthenticatedRecoverySet,
	recoverAuthenticatedSecret
} from '$lib/crypto/recovery-v3';

let relay: ReturnType<typeof serve> | null = null;

function matches(event: NostrEvent, filter: Filter): boolean {
	if (filter.ids && !filter.ids.includes(event.id)) return false;
	if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
	const recipients = filter['#p'];
	if (
		recipients &&
		!event.tags.some(([name, value]) => name === 'p' && recipients.includes(value))
	) {
		return false;
	}
	return true;
}

function startRelay(): { url: string; events: NostrEvent[] } {
	const events: NostrEvent[] = [];
	relay = serve({
		port: 0,
		fetch(request, server) {
			if (server.upgrade(request, { data: undefined })) return;
			return new Response('Nostr relay', { status: 200 });
		},
		websocket: {
			message(socket, message) {
				const parsed = JSON.parse(String(message)) as unknown[];
				if (parsed[0] === 'EVENT') {
					const event = parsed[1] as NostrEvent;
					events.push(event);
					socket.send(JSON.stringify(['OK', event.id, true, 'stored']));
					return;
				}
				if (parsed[0] === 'REQ') {
					const subscriptionId = String(parsed[1]);
					const filters = parsed.slice(2) as Filter[];
					for (const event of events) {
						if (filters.some((filter) => matches(event, filter))) {
							socket.send(JSON.stringify(['EVENT', subscriptionId, event]));
						}
					}
					socket.send(JSON.stringify(['EOSE', subscriptionId]));
				}
			}
		}
	});
	return { url: `ws://127.0.0.1:${relay.port}`, events };
}

afterEach(() => {
	relay?.stop(true);
	relay = null;
});

describe('Nostr v3 fake-relay recovery', () => {
	it('publishes, queries by exact ID, verifies every layer, and authenticates reconstruction', async () => {
		const fakeRelay = startRelay();
		const publisher = generateKeypair();
		const recipient = generateKeypair();
		const secretId = '550e8400-e29b-41d4-a716-446655440000';
		const recipientId = '660e8400-e29b-41d4-a716-446655440001';
		const recoverySet = createAuthenticatedRecoverySet('fake relay secret', {
			threshold: 2,
			total: 3
		});
		const share = recoverySet.envelopes[1];

		const publication = await publishSharesToNostr({
			secretId,
			shares: [{ recipientId, share, shareIndex: 2 }],
			recipients: [{ id: recipientId, nostrPubkey: recipient.publicKey }],
			senderSecretKey: publisher.secretKey,
			threshold: 2,
			totalShares: 3,
			relays: [fakeRelay.url]
		});

		expect(publication.errors).toEqual([]);
		expect(publication.published).toHaveLength(1);
		expect(fakeRelay.events).toHaveLength(1);

		const published = publication.published[0];
		const client = new NostrClient({ relays: [fakeRelay.url] });
		try {
			const events = await client.query({
				ids: [published.giftWrapEvent.id],
				kinds: [1059],
				'#p': [recipient.publicKey]
			});
			const recovered = unwrapRecoveryArtifactV3({
				giftWrapEvent: events[0],
				recipientSecretKey: recipient.secretKey,
				setupBundle: published.setupBundle
			});

			expect(recovered).toBe(share);
			expect(recoverAuthenticatedSecret([recoverySet.envelopes[0], recovered])).toBe(
				'fake relay secret'
			);
			published.plaintextK.fill(0);
		} finally {
			client.close();
		}
	});
});
