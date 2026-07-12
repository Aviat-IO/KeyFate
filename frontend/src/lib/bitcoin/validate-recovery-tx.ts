import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { decodeCSVTimelockScript } from './script';

export interface BitcoinRecoveryTxExpectations {
	fundingTxId: string;
	fundingOutputIndex: number;
	fundingAmountSats: number;
	timelockScriptHex: string;
	ttlBlocks: number;
	recipientAddress: string;
	network: 'mainnet' | 'testnet';
	nostrCapsuleEventId: string;
	maxFeeSats: number;
}

export interface ValidatedBitcoinRecoveryTx {
	symmetricKeyK: Uint8Array;
	nostrCapsuleEventId: string;
	recipientAmountSats: number;
	feeSats: number;
}

export function validateBitcoinRecoveryTransaction(
	txHex: string,
	expected: BitcoinRecoveryTxExpectations
): ValidatedBitcoinRecoveryTx {
	if (!/^(?:[0-9a-f]{2})+$/.test(txHex)) throw new Error('Recovery transaction is not hex');
	const bytes = hex.decode(txHex);
	const raw = btc.RawTx.decode(bytes);
	if (raw.inputs.length !== 1 || raw.outputs.length !== 2 || raw.witnesses?.length !== 1) {
		throw new Error('Recovery transaction must have one input and two outputs');
	}

	const input = raw.inputs[0];
	if (
		hex.encode(input.txid) !== expected.fundingTxId ||
		input.index !== expected.fundingOutputIndex ||
		input.sequence !== expected.ttlBlocks
	) {
		throw new Error('Recovery transaction funding outpoint or sequence mismatch');
	}

	const witness = raw.witnesses[0];
	const expectedScript = hex.decode(expected.timelockScriptHex);
	if (
		witness.length !== 3 ||
		witness[0].length < 9 ||
		witness[1].length !== 0 ||
		hex.encode(witness[2]) !== expected.timelockScriptHex
	) {
		throw new Error('Recovery transaction witness does not select the delayed branch');
	}
	const decodedScript = decodeCSVTimelockScript(expectedScript);
	if (decodedScript.ttlBlocks !== expected.ttlBlocks) {
		throw new Error('Recovery transaction timelock mismatch');
	}

	let opReturnPayload: Uint8Array | null = null;
	let recipientAmount = 0n;
	let recipientAddress: string | undefined;
	const network = expected.network === 'mainnet' ? btc.NETWORK : btc.TEST_NETWORK;
	const tx = btc.Transaction.fromRaw(bytes, {
		allowUnknownInputs: true,
		allowUnknownOutputs: true
	});

	for (let index = 0; index < raw.outputs.length; index++) {
		const output = raw.outputs[index];
		const decoded = btc.Script.decode(output.script);
		if (decoded[0] === 'RETURN') {
			if (opReturnPayload || decoded.length !== 2 || !(decoded[1] instanceof Uint8Array)) {
				throw new Error('Invalid OP_RETURN recovery output');
			}
			opReturnPayload = decoded[1];
		} else {
			recipientAmount = output.amount;
			recipientAddress = tx.getOutputAddress(index, network);
		}
	}

	if (!opReturnPayload || opReturnPayload.length !== 64) {
		throw new Error('Recovery transaction OP_RETURN must contain K and capsule ID');
	}
	if (recipientAddress !== expected.recipientAddress || recipientAmount < 546n) {
		throw new Error('Recovery transaction recipient output mismatch');
	}

	const capsuleEventId = hex.encode(opReturnPayload.slice(32));
	if (capsuleEventId !== expected.nostrCapsuleEventId) {
		throw new Error('Recovery transaction capsule binding mismatch');
	}
	const fee = BigInt(expected.fundingAmountSats) - recipientAmount;
	if (fee <= 0n || fee > BigInt(expected.maxFeeSats)) {
		throw new Error('Recovery transaction fee is outside the approved bound');
	}

	const signatureWithHashType = witness[0];
	const hashType = signatureWithHashType[signatureWithHashType.length - 1];
	if (hashType !== 1) throw new Error('Recovery transaction must use SIGHASH_ALL');
	const signature = signatureWithHashType.slice(0, -1);
	const digest = tx.preimageWitnessV0(
		0,
		expectedScript,
		hashType,
		BigInt(expected.fundingAmountSats)
	);
	if (
		!secp256k1.verify(signature, digest, decodedScript.recipientPubkey, {
			prehash: false,
			lowS: true,
			format: 'der'
		})
	) {
		throw new Error('Recovery transaction delayed-branch signature is invalid');
	}

	return {
		symmetricKeyK: opReturnPayload.slice(0, 32),
		nostrCapsuleEventId: capsuleEventId,
		recipientAmountSats: Number(recipientAmount),
		feeSats: Number(fee)
	};
}
