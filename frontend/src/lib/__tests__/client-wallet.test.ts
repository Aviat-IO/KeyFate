import { describe, expect, it } from 'vitest';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import {
	bitcoinKeypairFromPrivateKey,
	generateBitcoinKeypair,
	zeroBitcoinKeypair
} from '$lib/bitcoin/client-wallet';

describe('ephemeral Bitcoin keypair', () => {
	it('generates a valid private key and matching compressed public key', () => {
		const keypair = generateBitcoinKeypair();
		expect(keypair.privkey).toHaveLength(32);
		expect(keypair.pubkey).toHaveLength(33);
		expect(secp256k1.utils.isValidSecretKey(keypair.privkey)).toBe(true);
		expect(Array.from(keypair.pubkey)).toEqual(
			Array.from(secp256k1.getPublicKey(keypair.privkey, true))
		);
	});

	it('derives a keypair from an explicit continuity key', () => {
		const privateKey = new Uint8Array(32);
		privateKey[31] = 1;
		const keypair = bitcoinKeypairFromPrivateKey(privateKey);
		expect(keypair.privkey).not.toBe(privateKey);
		expect(keypair.pubkey).toHaveLength(33);
	});

	it('zeroes private key bytes without persisting them', () => {
		const keypair = generateBitcoinKeypair();
		zeroBitcoinKeypair(keypair);
		expect(Array.from(keypair.privkey)).toEqual(new Array(32).fill(0));
	});
});
