import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	decryptBitcoinRecoveryEnvelope,
	encryptBitcoinRecoveryEnvelope
} from '../recovery-envelope';

const SECRET_ID = '11111111-1111-4111-8111-111111111111';

function content() {
	return {
		version: 1 as const,
		secretId: SECRET_ID,
		generation: 1,
		network: 'testnet' as const,
		txHex: '00'.repeat(120),
		fundingTxId: '11'.repeat(32),
		fundingOutputIndex: 0,
		amountSats: 25_000,
		timelockScriptHex: '51',
		ttlBlocks: 144,
		recipientAddress: 'tb1qexample000000000000000000000000000000000',
		maxFeeSats: 1_000,
		nostrCapsuleEventId: '22'.repeat(32),
		nostrManifestEvent: { signed: 'manifest' },
		nostrCapsuleEvent: { signed: 'capsule' }
	};
}

describe('recipient-encrypted Bitcoin recovery envelope', () => {
	it('round-trips only for the bound recipient and sender', () => {
		const sender = generateSecretKey();
		const recipient = generateSecretKey();
		const envelope = encryptBitcoinRecoveryEnvelope(content(), sender, getPublicKey(recipient));

		expect(JSON.stringify(envelope)).not.toContain(content().txHex);
		expect(decryptBitcoinRecoveryEnvelope(envelope, recipient, getPublicKey(sender))).toEqual(
			content()
		);
	});

	it('rejects the wrong recipient', () => {
		const sender = generateSecretKey();
		const recipient = generateSecretKey();
		const envelope = encryptBitcoinRecoveryEnvelope(content(), sender, getPublicKey(recipient));
		expect(() =>
			decryptBitcoinRecoveryEnvelope(envelope, generateSecretKey(), getPublicKey(sender))
		).toThrow('recipient mismatch');
	});

	it('rejects a substituted sender binding', () => {
		const sender = generateSecretKey();
		const recipient = generateSecretKey();
		const envelope = encryptBitcoinRecoveryEnvelope(content(), sender, getPublicKey(recipient));
		expect(() =>
			decryptBitcoinRecoveryEnvelope(envelope, recipient, getPublicKey(generateSecretKey()))
		).toThrow('sender mismatch');
	});
});
