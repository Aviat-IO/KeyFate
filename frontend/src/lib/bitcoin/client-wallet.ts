/** Ephemeral browser-only Bitcoin key utilities. No Web Storage persistence. */

import { secp256k1 } from '@noble/curves/secp256k1.js';

export interface BitcoinKeypair {
	privkey: Uint8Array;
	pubkey: Uint8Array;
}

export function generateBitcoinKeypair(): BitcoinKeypair {
	let privkey: Uint8Array;
	do {
		privkey = crypto.getRandomValues(new Uint8Array(32));
	} while (!secp256k1.utils.isValidSecretKey(privkey));
	return { privkey, pubkey: secp256k1.getPublicKey(privkey, true) };
}

export function bitcoinKeypairFromPrivateKey(privkey: Uint8Array): BitcoinKeypair {
	if (!secp256k1.utils.isValidSecretKey(privkey)) throw new Error('Invalid Bitcoin private key');
	return {
		privkey: new Uint8Array(privkey),
		pubkey: secp256k1.getPublicKey(privkey, true)
	};
}

export function zeroBitcoinKeypair(keypair: BitcoinKeypair): void {
	keypair.privkey.fill(0);
}
