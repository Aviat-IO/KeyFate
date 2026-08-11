import { describe, expect, it } from 'vitest';
import type { Event as NostrEvent } from 'nostr-tools/core';
import {
	createAuthenticatedRecoverySet,
	parseRecoveryShareEnvelope,
	recoverAuthenticatedSecret
} from '../crypto/recovery-v3';
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
	it('rejects every new authenticated service request whose threshold is not 2', () => {
		const { envelopes } = createAuthenticatedRecoverySet('secret', { total: 4, threshold: 3 });
		for (const enableNostrShares of [false, true]) {
			expect(() =>
				buildSecretCreationPayload({
					title: 'Invalid authenticated threshold',
					serverShare: envelopes[0],
					recipients: [
						{
							name: 'Recipient',
							email: 'recipient@example.com',
							nostrPubkey: `npub1${'q'.repeat(58)}`
						}
					],
					checkInDays: 30,
					totalShares: 4,
					threshold: 3,
					enableNostrShares,
					enableBitcoinTimelock: false
				})
			).toThrow('requires a threshold of 2');
		}
	});

	it('sends only the v3 service envelope and opaque signed recovery artifacts to the server', () => {
		const secret = 'launch secret 🔐 電池';
		const recoverySet = createAuthenticatedRecoverySet(secret, { total: 3, threshold: 2 });
		const serverShare = recoverySet.envelopes[0];
		const recipientShare = recoverySet.envelopes[1];
		const offlineShare = recoverySet.envelopes[2];
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
				capsuleEvent: opaqueEvent('55'.repeat(32), 21060),
				manifestEvent: opaqueEvent('44'.repeat(32), 21061)
			}
		]);
		const registrationBody = JSON.stringify(registration);
		const observedServerBodies = [creationBody, registrationBody].join('\n');

		const parsedCreation = JSON.parse(creationBody) as { server_share: string };
		expect(parsedCreation.server_share).toBe(serverShare);
		expect(parseRecoveryShareEnvelope(serverShare)).toEqual(
			expect.objectContaining({ index: 1, threshold: 2, total: 3 })
		);
		expect(recoverAuthenticatedSecret([serverShare, recipientShare])).toBe(secret);
		expect(creationBody).not.toContain(secret);
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
		expect(Object.keys(registration.artifacts[0])).toEqual([
			'giftWrapEvent',
			'capsuleEvent',
			'manifestEvent'
		]);
	});
});
