import { describe, expect, it } from 'vitest';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { doubleEncryptShare } from '$lib/crypto/double-encrypt';
import {
	createRecoveryCapsule,
	createRecoveryManifest,
	RECOVERY_CAPSULE_VERSION
} from '$lib/nostr/recovery-capsule';
import { wrapCapsuleForRecipient } from '$lib/nostr/gift-wrap';
import { generateBitcoinKeypair } from '../client-wallet';
import { createCSVTimelockScript } from '../script';
import { createPreSignedRecipientTx } from '../transaction';
import { encryptBitcoinRecoveryEnvelope } from '../recovery-envelope';
import { recoverShareFromBitcoinEnvelope } from '$lib/crypto/recovery-flows';

const SECRET_ID = '11111111-1111-4111-8111-111111111111';
const RECIPIENT_ID = '22222222-2222-4222-8222-222222222222';

describe('Bitcoin recipient recovery v2', () => {
	it('decrypts the envelope, verifies the transaction/capsule, and returns the share', async () => {
		const publisherSecret = generateSecretKey();
		const recipientNostrSecret = generateSecretKey();
		const recipientNostrPubkey = getPublicKey(recipientNostrSecret);
		const share = '80deadbeef';
		const encrypted = await doubleEncryptShare(share, recipientNostrPubkey, publisherSecret);
		const capsule = createRecoveryCapsule(
			{
				version: RECOVERY_CAPSULE_VERSION,
				secretId: SECRET_ID,
				recipientId: RECIPIENT_ID,
				recipientNostrPubkey,
				shareIndex: 1,
				threshold: 2,
				totalShares: 3,
				encryptedShareHex: hex.encode(encrypted.encryptedShare),
				nonceHex: hex.encode(encrypted.nonce),
				encryptedKNostr: encrypted.encryptedKNostr
			},
			publisherSecret
		);
		const giftWrap = wrapCapsuleForRecipient(capsule, publisherSecret, recipientNostrPubkey);
		const manifest = createRecoveryManifest(
			{
				version: RECOVERY_CAPSULE_VERSION,
				secretId: SECRET_ID,
				recipientId: RECIPIENT_ID,
				recipientNostrPubkey,
				publisherPubkey: getPublicKey(publisherSecret),
				giftWrapEventId: giftWrap.id,
				capsuleEventId: capsule.id
			},
			publisherSecret
		);

		const owner = generateBitcoinKeypair();
		const delayedBranch = generateBitcoinKeypair();
		const recipientWallet = generateBitcoinKeypair();
		const recipientAddress = btc.p2wpkh(recipientWallet.pubkey, btc.TEST_NETWORK).address!;
		const timelockScript = createCSVTimelockScript(owner.pubkey, delayedBranch.pubkey, 144);
		const fundingTxId = '33'.repeat(32);
		const delayedTx = createPreSignedRecipientTx({
			timelockUtxo: { txId: fundingTxId, outputIndex: 0, amountSats: 50_000 },
			timelockScript,
			recipientPrivkey: delayedBranch.privkey,
			recipientAddress,
			ttlBlocks: 144,
			symmetricKeyK: encrypted.plaintextK,
			nostrEventId: capsule.id,
			feeRateSatsPerVbyte: 2,
			network: 'testnet'
		});
		const envelope = encryptBitcoinRecoveryEnvelope(
			{
				version: 1,
				secretId: SECRET_ID,
				generation: 1,
				network: 'testnet',
				txHex: delayedTx.txHex,
				fundingTxId,
				fundingOutputIndex: 0,
				amountSats: 50_000,
				timelockScriptHex: hex.encode(timelockScript),
				ttlBlocks: 144,
				recipientAddress,
				maxFeeSats: 1_000,
				nostrCapsuleEventId: capsule.id,
				nostrManifestEvent: manifest,
				nostrCapsuleEvent: capsule
			},
			owner.privkey,
			recipientNostrPubkey
		);

		const result = recoverShareFromBitcoinEnvelope(
			envelope,
			recipientNostrSecret,
			getPublicKey(owner.privkey),
			1
		);
		expect(result).toEqual({
			share,
			shareIndex: 1,
			threshold: 2,
			totalShares: 3,
			secretId: SECRET_ID,
			transactionHex: delayedTx.txHex,
			network: 'testnet',
			recipientAddress,
			generation: 1
		});
		expect(() =>
			recoverShareFromBitcoinEnvelope(
				envelope,
				recipientNostrSecret,
				getPublicKey(owner.privkey),
				2
			)
		).toThrow('Bitcoin recovery envelope is not the expected current generation');
	});
});
