import { describe, expect, it } from 'vitest';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { generateBitcoinKeypair } from '../client-wallet';
import { createCSVTimelockScript } from '../script';
import { createPreSignedRecipientTx } from '../transaction';
import { validateBitcoinRecoveryTransaction } from '../validate-recovery-tx';

function fixture() {
	const owner = generateBitcoinKeypair();
	const delayedBranch = generateBitcoinKeypair();
	const recipientWallet = generateBitcoinKeypair();
	const recipientAddress = btc.p2wpkh(recipientWallet.pubkey, btc.TEST_NETWORK).address!;
	const timelockScript = createCSVTimelockScript(owner.pubkey, delayedBranch.pubkey, 144);
	const K = new Uint8Array(32).fill(3);
	const capsuleId = '22'.repeat(32);
	const tx = createPreSignedRecipientTx({
		timelockUtxo: { txId: '11'.repeat(32), outputIndex: 2, amountSats: 50_000 },
		timelockScript,
		recipientPrivkey: delayedBranch.privkey,
		recipientAddress,
		ttlBlocks: 144,
		symmetricKeyK: K,
		nostrEventId: capsuleId,
		feeRateSatsPerVbyte: 2,
		network: 'testnet'
	});
	const expected = {
		fundingTxId: '11'.repeat(32),
		fundingOutputIndex: 2,
		fundingAmountSats: 50_000,
		timelockScriptHex: hex.encode(timelockScript),
		ttlBlocks: 144,
		recipientAddress,
		network: 'testnet' as const,
		nostrCapsuleEventId: capsuleId,
		maxFeeSats: 1_000
	};
	return { ...tx, expected, K };
}

describe('validateBitcoinRecoveryTransaction', () => {
	it('validates outpoint, CSV branch, recipient, OP_RETURN, fee, and signature', () => {
		const value = fixture();
		const result = validateBitcoinRecoveryTransaction(value.txHex, value.expected);
		expect(Array.from(result.symmetricKeyK)).toEqual(Array.from(value.K));
		expect(result.nostrCapsuleEventId).toBe(value.expected.nostrCapsuleEventId);
		expect(result.feeSats).toBeGreaterThan(0);
	});

	it('rejects recipient substitution', () => {
		const value = fixture();
		expect(() =>
			validateBitcoinRecoveryTransaction(value.txHex, {
				...value.expected,
				recipientAddress: btc.p2wpkh(generateBitcoinKeypair().pubkey, btc.TEST_NETWORK).address!
			})
		).toThrow('recipient output mismatch');
	});

	it('rejects a changed funding outpoint or capsule binding', () => {
		const value = fixture();
		expect(() =>
			validateBitcoinRecoveryTransaction(value.txHex, {
				...value.expected,
				fundingOutputIndex: 3
			})
		).toThrow('outpoint');
		expect(() =>
			validateBitcoinRecoveryTransaction(value.txHex, {
				...value.expected,
				nostrCapsuleEventId: '33'.repeat(32)
			})
		).toThrow('capsule binding');
	});

	it('rejects a modified delayed-branch signature', () => {
		const value = fixture();
		const raw = btc.RawTx.decode(hex.decode(value.txHex));
		raw.witnesses![0][0][10] ^= 1;
		const modified = hex.encode(btc.RawTx.encode(raw));
		expect(() => validateBitcoinRecoveryTransaction(modified, value.expected)).toThrow();
	});
});
