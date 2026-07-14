import { describe, expect, it } from 'vitest';
import { encryptRecoveryKit } from '$lib/crypto/recovery-kit';
import {
	decryptBitcoinContinuityKit,
	encryptBitcoinContinuityKit,
	type BitcoinContinuityData
} from '$lib/bitcoin/continuity-kit';

const signedEvent = {
	id: '55'.repeat(32),
	pubkey: '66'.repeat(32),
	created_at: 1,
	kind: 30078,
	tags: [],
	content: '{}',
	sig: '77'.repeat(64)
};

const continuity: BitcoinContinuityData = {
	format: 'keyfate-bitcoin-continuity',
	version: 2,
	secretId: '550e8400-e29b-41d4-a716-446655440000',
	network: 'signet',
	generation: 2,
	ownerPrivateKeyHex: '11'.repeat(32),
	symmetricKeyHex: '22'.repeat(32),
	nostrCapsuleEventId: '33'.repeat(32),
	nostrManifestEvent: signedEvent,
	nostrCapsuleEvent: { ...signedEvent, id: '88'.repeat(32) },
	recipientId: '660e8400-e29b-41d4-a716-446655440000',
	recipientNostrPubkey: '99'.repeat(32),
	recipientAddress: 'tb1qexamplecontinuitydestination000000000',
	ttlBlocks: 4320,
	currentUtxo: {
		txId: '44'.repeat(32),
		outputIndex: 0,
		amountSats: 50_000
	},
	currentTimelockScriptHex: '51'
};

describe('encrypted Bitcoin owner continuity kit v2', () => {
	it('round-trips signed refresh bindings after a browser restart', async () => {
		const envelope = await encryptBitcoinContinuityKit(continuity, 'correct horse battery staple');
		expect(await decryptBitcoinContinuityKit(envelope, 'correct horse battery staple')).toEqual(
			continuity
		);
	});

	it('does not expose private key or K in the durable envelope', async () => {
		const envelope = await encryptBitcoinContinuityKit(continuity, 'correct horse battery staple');
		const serialized = JSON.stringify(envelope);
		expect(serialized).not.toContain(continuity.ownerPrivateKeyHex);
		expect(serialized).not.toContain(continuity.symmetricKeyHex);
	});

	it('fails closed for the wrong passphrase', async () => {
		const envelope = await encryptBitcoinContinuityKit(continuity, 'correct horse battery staple');
		await expect(decryptBitcoinContinuityKit(envelope, 'wrong passphrase value')).rejects.toThrow();
	});

	it('rejects legacy v1 for refresh with a clear re-enrollment path', async () => {
		const envelope = await encryptRecoveryKit(
			{
				format: 'keyfate-bitcoin-continuity',
				version: 1,
				secretId: continuity.secretId
			},
			'correct horse battery staple'
		);
		await expect(
			decryptBitcoinContinuityKit(envelope, 'correct horse battery staple')
		).rejects.toThrow('version 1 cannot refresh');
	});
});
