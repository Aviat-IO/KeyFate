import { hex } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
	blocksToApproxDays,
	createCSVTimelockScript,
	createP2WSHAddress,
	daysToBlocks,
	getP2WSHOutputScript,
	type BitcoinTimelockNetwork
} from './script.js';

export interface BitcoinTimelockDemoParams {
	network?: BitcoinTimelockNetwork;
	days?: number;
	amountSats?: number;
	ownerSeed?: string;
	recipientSeed?: string;
}

export interface BitcoinTimelockDemoVector {
	network: BitcoinTimelockNetwork;
	addressNetworkNote?: string;
	amountSats: number;
	ttlBlocks: number;
	approxDays: number;
	ownerPubkey: string;
	recipientPubkey: string;
	witnessScriptHex: string;
	p2wshScriptPubKeyHex: string;
	p2wshAddress: string;
	fundingOutput: {
		address: string;
		amountSats: number;
		scriptPubKeyHex: string;
	};
	spendPolicy: {
		owner: string;
		recipient: string;
	};
	limitations: string[];
}

function privateKeyFromSeed(seed: string): Uint8Array {
	const digest = sha256(new TextEncoder().encode(seed));
	if (!secp256k1.utils.isValidSecretKey(digest)) {
		throw new Error('Derived demo private key is invalid; choose a different seed');
	}
	return digest;
}

function compressedPubkeyFromSeed(seed: string): Uint8Array {
	return secp256k1.getPublicKey(privateKeyFromSeed(seed), true);
}

export function buildBitcoinTimelockDemo(
	params: BitcoinTimelockDemoParams = {}
): BitcoinTimelockDemoVector {
	const network = params.network ?? 'signet';
	const days = params.days ?? 7;
	const amountSats = params.amountSats ?? 10_000;
	const ownerPubkey = compressedPubkeyFromSeed(params.ownerSeed ?? 'keyfate-demo-owner-v1');
	const recipientPubkey = compressedPubkeyFromSeed(
		params.recipientSeed ?? 'keyfate-demo-recipient-v1'
	);
	const ttlBlocks = daysToBlocks(days);
	const witnessScript = createCSVTimelockScript(ownerPubkey, recipientPubkey, ttlBlocks);
	const p2wshScriptPubKey = getP2WSHOutputScript(witnessScript, network);
	const p2wshAddress = createP2WSHAddress(witnessScript, network);

	return {
		network,
		addressNetworkNote:
			network === 'signet'
				? 'Signet uses testnet bech32 address parameters; the address intentionally starts with tb1.'
				: undefined,
		amountSats,
		ttlBlocks,
		approxDays: blocksToApproxDays(ttlBlocks),
		ownerPubkey: hex.encode(ownerPubkey),
		recipientPubkey: hex.encode(recipientPubkey),
		witnessScriptHex: hex.encode(witnessScript),
		p2wshScriptPubKeyHex: hex.encode(p2wshScriptPubKey),
		p2wshAddress,
		fundingOutput: {
			address: p2wshAddress,
			amountSats,
			scriptPubKeyHex: hex.encode(p2wshScriptPubKey)
		},
		spendPolicy: {
			owner: 'Owner can spend immediately through the IF branch with owner_pubkey CHECKSIG.',
			recipient: `Recipient can spend through the ELSE branch after ${ttlBlocks} confirmations using CHECKSEQUENCEVERIFY.`
		},
		limitations: [
			'Demo seeds are deterministic and public; never fund this vector with real value.',
			'This preview builds the timelocked output/address, not a wallet-funded broadcast transaction.',
			'CSV is block-relative and approximate in wall-clock time; refresh requires spending into a new timelock UTXO.',
			'Production use still needs wallet UX, fee/rbf handling, UTXO monitoring, key backup, and recovery drills.'
		]
	};
}
