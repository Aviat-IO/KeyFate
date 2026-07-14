import { describe, expect, it } from 'vitest';
import { Buffer } from 'buffer';
import sss from 'shamirs-secret-sharing';
import type { Event as NostrEvent } from 'nostr-tools/core';
import {
	buildNostrRegistrationPayload,
	buildSecretCreationPayload
} from './secret-creation-payload';

function opaqueEvent(id: string, kind: number): NostrEvent {
	return {
		id,
		pubkey: '11'.repeat(32),
		created_at: 1_700_000_000,
		kind,
		tags: [],
		content: 'opaque-ciphertext',
		sig: '22'.repeat(64)
	};
}

describe('default 2-of-3 secret creation request boundary', () => {
	it('sends only the service share and opaque signed recovery artifacts to the server', () => {
		const shares = sss.split(Buffer.from('launch secret'), { shares: 3, threshold: 2 });
		const serverShare = shares[0].toString('hex');
		const recipientShare = shares[1].toString('hex');
		const offlineShare = shares[2].toString('hex');
		const symmetricKey = 'aa'.repeat(32);
		const publisherSecret = 'bb'.repeat(32);
		const passphrase = 'correct horse battery staple';

		const creationBody = JSON.stringify(
			buildSecretCreationPayload({
				title: 'Launch plan',
				serverShare,
				recipients: [
					{
						name: 'Recipient',
						email: 'recipient@example.com',
						nostrPubkey: `npub1${'q'.repeat(58)}`
					}
				],
				checkInDays: 30,
				totalShares: 3,
				threshold: 2,
				enableNostrShares: true,
				enableBitcoinTimelock: false
			})
		);
		const registration = buildNostrRegistrationPayload([
			{
				giftWrapEvent: opaqueEvent('33'.repeat(32), 1059),
				manifestEvent: opaqueEvent('44'.repeat(32), 21061)
			}
		]);
		const registrationBody = JSON.stringify(registration);
		const observedServerBodies = [creationBody, registrationBody].join('\n');

		expect(creationBody).toContain(serverShare);
		for (const forbidden of [
			recipientShare,
			offlineShare,
			symmetricKey,
			publisherSecret,
			passphrase
		]) {
			expect(observedServerBodies).not.toContain(forbidden);
		}
		expect(Object.keys(registration)).toEqual(['artifacts']);
		expect(Object.keys(registration.artifacts[0])).toEqual(['giftWrapEvent', 'manifestEvent']);
	});
});
