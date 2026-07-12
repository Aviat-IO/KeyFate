import { describe, expect, it } from 'vitest';
import {
	decryptBitcoinContinuityKit,
	encryptBitcoinContinuityKit,
	type BitcoinContinuityData
} from '$lib/bitcoin/continuity-kit';

const continuity: BitcoinContinuityData = {
	format: 'keyfate-bitcoin-continuity',
	version: 1,
	secretId: '550e8400-e29b-41d4-a716-446655440000',
	network: 'testnet',
	generation: 2,
	ownerPrivateKeyHex: '11'.repeat(32),
	symmetricKeyHex: '22'.repeat(32),
	nostrEventId: '33'.repeat(32),
	recipientAddress: 'tb1qexamplecontinuitydestination000000000',
	ttlBlocks: 4320,
	currentUtxo: {
		txId: '44'.repeat(32),
		outputIndex: 0,
		amountSats: 50_000
	},
	currentTimelockScriptHex: '51'
};

describe('encrypted Bitcoin owner continuity kit', () => {
	it('round-trips all refresh material after a browser restart', async () => {
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
});
