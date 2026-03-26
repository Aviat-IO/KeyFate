/**
 * Client-side Bitcoin transaction operations.
 *
 * Orchestrates the full Bitcoin flow from the browser:
 * key generation → transaction creation → signing → broadcast → result storage.
 *
 * No private keys leave the browser.
 */

import {
  createTimelockUTXO,
  createPreSignedRecipientTx,
  type UTXO,
} from "./transaction.js"
import { refreshTimelockUTXO } from "./refresh.js"
import { broadcastTransaction } from "./broadcast.js"
import type { BitcoinKeypair } from "./client-wallet.js"

export interface EnableBitcoinClientParams {
  ownerKeypair: BitcoinKeypair
  recipientKeypair: BitcoinKeypair
  fundingUtxo: UTXO
  amountSats: number
  feeRateSatsPerVbyte: number
  symmetricKeyK: Uint8Array
  nostrEventId: string
  recipientAddress: string
  ttlBlocks: number
  network: "mainnet" | "testnet"
}

export interface EnableBitcoinClientResult {
  txId: string
  outputIndex: number
  timelockScript: Uint8Array
  preSignedRecipientTx: string
  ownerPubkey: Uint8Array
  recipientPubkey: Uint8Array
}

/**
 * Client-side: create timelock UTXO, broadcast it, create pre-signed recipient tx.
 * No private keys leave the browser.
 */
export async function enableBitcoinClient(
  params: EnableBitcoinClientParams,
): Promise<EnableBitcoinClientResult> {
  // 1. Create the timelock UTXO transaction
  const utxoResult = createTimelockUTXO({
    ownerPrivkey: params.ownerKeypair.privkey,
    ownerPubkey: params.ownerKeypair.pubkey,
    recipientPubkey: params.recipientKeypair.pubkey,
    ttlBlocks: params.ttlBlocks,
    amountSats: params.amountSats,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    fundingUtxo: params.fundingUtxo,
    network: params.network,
  })

  // 2. Broadcast the transaction
  const txId = await broadcastTransaction(utxoResult.txHex, params.network)

  // 3. Create pre-signed recipient tx
  const preSignedResult = createPreSignedRecipientTx({
    timelockUtxo: {
      txId,
      outputIndex: utxoResult.outputIndex,
      amountSats: params.amountSats,
    },
    timelockScript: utxoResult.timelockScript,
    recipientPrivkey: params.recipientKeypair.privkey,
    recipientAddress: params.recipientAddress,
    ttlBlocks: params.ttlBlocks,
    symmetricKeyK: params.symmetricKeyK,
    nostrEventId: params.nostrEventId,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    network: params.network,
  })

  return {
    txId,
    outputIndex: utxoResult.outputIndex,
    timelockScript: utxoResult.timelockScript,
    preSignedRecipientTx: preSignedResult.txHex,
    ownerPubkey: params.ownerKeypair.pubkey,
    recipientPubkey: params.recipientKeypair.pubkey,
  }
}

export interface RefreshBitcoinClientParams {
  ownerKeypair: BitcoinKeypair
  recipientPubkey: Uint8Array
  currentUtxo: { txId: string; outputIndex: number; amountSats: number }
  currentScript: Uint8Array
  ttlBlocks: number
  feeRateSatsPerVbyte: number
  symmetricKeyK: Uint8Array
  nostrEventId: string
  recipientPrivkey: Uint8Array
  recipientAddress: string
  network: "mainnet" | "testnet"
}

export interface RefreshBitcoinClientResult {
  newTxId: string
  newOutputIndex: number
  newTimelockScript: Uint8Array
  newAmountSats: number
  preSignedRecipientTx: string
}

/**
 * Client-side: refresh (check-in) a timelock UTXO.
 * Spends the current UTXO via the owner path, creates a new one,
 * broadcasts, and creates a new pre-signed recipient tx.
 */
export async function refreshBitcoinClient(
  params: RefreshBitcoinClientParams,
): Promise<RefreshBitcoinClientResult> {
  // 1. Create the refresh transaction
  const refreshResult = refreshTimelockUTXO({
    currentUtxo: params.currentUtxo,
    currentScript: params.currentScript,
    ownerPrivkey: params.ownerKeypair.privkey,
    ownerPubkey: params.ownerKeypair.pubkey,
    recipientPubkey: params.recipientPubkey,
    ttlBlocks: params.ttlBlocks,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    network: params.network,
  })

  // 2. Broadcast the refresh transaction
  const newTxId = await broadcastTransaction(refreshResult.txHex, params.network)

  // Calculate new amount (original minus fee)
  const estimatedFee = Math.ceil(204 * params.feeRateSatsPerVbyte)
  const newAmountSats = params.currentUtxo.amountSats - estimatedFee

  // 3. Create pre-signed recipient tx for the new UTXO
  const preSignedResult = createPreSignedRecipientTx({
    timelockUtxo: {
      txId: newTxId,
      outputIndex: refreshResult.newOutputIndex,
      amountSats: newAmountSats,
    },
    timelockScript: refreshResult.newTimelockScript,
    recipientPrivkey: params.recipientPrivkey,
    recipientAddress: params.recipientAddress,
    ttlBlocks: params.ttlBlocks,
    symmetricKeyK: params.symmetricKeyK,
    nostrEventId: params.nostrEventId,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    network: params.network,
  })

  return {
    newTxId,
    newOutputIndex: refreshResult.newOutputIndex,
    newTimelockScript: refreshResult.newTimelockScript,
    newAmountSats,
    preSignedRecipientTx: preSignedResult.txHex,
  }
}
