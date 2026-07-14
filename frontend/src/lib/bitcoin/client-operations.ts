/**
 * Browser-only Bitcoin transaction orchestration.
 *
 * The owner continuity key may be restored from an explicitly encrypted owner
 * kit. A fresh branch key signs exactly one delayed recipient transaction and
 * is zeroed before the operation returns. The real recipient controls only the
 * destination address.
 */

import { createTimelockUTXO, createPreSignedRecipientTx, type UTXO } from './transaction.js';
import { refreshTimelockUTXO } from './refresh.js';
import { broadcastTransaction } from './broadcast.js';
import { zeroBitcoinKeypair, type BitcoinKeypair } from './client-wallet.js';
import type { BitcoinNetwork } from './network.js';

export interface EnableBitcoinClientParams {
	ownerKeypair: BitcoinKeypair;
	branchKeypair: BitcoinKeypair;
	fundingUtxo: UTXO;
	amountSats: number;
	feeRateSatsPerVbyte: number;
	symmetricKeyK: Uint8Array;
	nostrEventId: string;
	recipientAddress: string;
	ttlBlocks: number;
	network: BitcoinNetwork;
}

export interface EnableBitcoinClientResult {
	txId: string;
	outputIndex: number;
	timelockScript: Uint8Array;
	preSignedRecipientTx: string;
	ownerPubkey: Uint8Array;
	branchPubkey: Uint8Array;
}

export async function enableBitcoinClient(
	params: EnableBitcoinClientParams
): Promise<EnableBitcoinClientResult> {
	try {
		const utxoResult = createTimelockUTXO({
			ownerPrivkey: params.ownerKeypair.privkey,
			ownerPubkey: params.ownerKeypair.pubkey,
			recipientPubkey: params.branchKeypair.pubkey,
			ttlBlocks: params.ttlBlocks,
			amountSats: params.amountSats,
			feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
			fundingUtxo: params.fundingUtxo,
			network: params.network
		});

		const txId = await broadcastTransaction(utxoResult.txHex, params.network, utxoResult.txId);
		const preSignedResult = createPreSignedRecipientTx({
			timelockUtxo: {
				txId,
				outputIndex: utxoResult.outputIndex,
				amountSats: params.amountSats
			},
			timelockScript: utxoResult.timelockScript,
			recipientPrivkey: params.branchKeypair.privkey,
			recipientAddress: params.recipientAddress,
			ttlBlocks: params.ttlBlocks,
			symmetricKeyK: params.symmetricKeyK,
			nostrEventId: params.nostrEventId,
			feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
			network: params.network
		});

		return {
			txId,
			outputIndex: utxoResult.outputIndex,
			timelockScript: utxoResult.timelockScript,
			preSignedRecipientTx: preSignedResult.txHex,
			ownerPubkey: params.ownerKeypair.pubkey,
			branchPubkey: params.branchKeypair.pubkey
		};
	} finally {
		zeroBitcoinKeypair(params.branchKeypair);
	}
}

export interface RefreshBitcoinClientParams {
	ownerKeypair: BitcoinKeypair;
	newBranchKeypair: BitcoinKeypair;
	currentUtxo: { txId: string; outputIndex: number; amountSats: number };
	currentScript: Uint8Array;
	ttlBlocks: number;
	feeRateSatsPerVbyte: number;
	symmetricKeyK: Uint8Array;
	nostrEventId: string;
	recipientAddress: string;
	network: BitcoinNetwork;
}

export interface RefreshBitcoinClientResult {
	newTxId: string;
	newOutputIndex: number;
	newTimelockScript: Uint8Array;
	newAmountSats: number;
	preSignedRecipientTx: string;
	newBranchPubkey: Uint8Array;
}

export async function refreshBitcoinClient(
	params: RefreshBitcoinClientParams
): Promise<RefreshBitcoinClientResult> {
	try {
		const refreshResult = refreshTimelockUTXO({
			currentUtxo: params.currentUtxo,
			currentScript: params.currentScript,
			ownerPrivkey: params.ownerKeypair.privkey,
			ownerPubkey: params.ownerKeypair.pubkey,
			recipientPubkey: params.newBranchKeypair.pubkey,
			ttlBlocks: params.ttlBlocks,
			feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
			network: params.network
		});

		const newTxId = await broadcastTransaction(
			refreshResult.txHex,
			params.network,
			refreshResult.newTxId
		);
		const estimatedFee = Math.ceil(204 * params.feeRateSatsPerVbyte);
		const newAmountSats = params.currentUtxo.amountSats - estimatedFee;
		const preSignedResult = createPreSignedRecipientTx({
			timelockUtxo: {
				txId: newTxId,
				outputIndex: refreshResult.newOutputIndex,
				amountSats: newAmountSats
			},
			timelockScript: refreshResult.newTimelockScript,
			recipientPrivkey: params.newBranchKeypair.privkey,
			recipientAddress: params.recipientAddress,
			ttlBlocks: params.ttlBlocks,
			symmetricKeyK: params.symmetricKeyK,
			nostrEventId: params.nostrEventId,
			feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
			network: params.network
		});

		return {
			newTxId,
			newOutputIndex: refreshResult.newOutputIndex,
			newTimelockScript: refreshResult.newTimelockScript,
			newAmountSats,
			preSignedRecipientTx: preSignedResult.txHex,
			newBranchPubkey: params.newBranchKeypair.pubkey
		};
	} finally {
		zeroBitcoinKeypair(params.newBranchKeypair);
	}
}
