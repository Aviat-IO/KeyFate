/**
 * Check-in refresh: spend UTXO via owner path, recreate with new timelock.
 *
 * When the owner checks in, the current timelock UTXO is spent via the
 * IF (owner) branch and a new UTXO is created with a fresh timelock.
 * This resets the dead man's switch clock.
 */

import * as btc from "@scure/btc-signer"
import { hex } from "@scure/base"
import { sha256 } from "@noble/hashes/sha2.js"
import {
  createCSVTimelockScript,
  getP2WSHOutputScript,
  MIN_UTXO_SATS,
} from "./script.js"

/** Result of refreshing a timelock UTXO */
export interface RefreshResult {
  /** Serialized transaction hex */
  txHex: string
  /** New transaction ID */
  newTxId: string
  /** Output index of the new timelock UTXO */
  newOutputIndex: number
  /** The new timelock script */
  newTimelockScript: Uint8Array
}

/**
 * Refresh a timelock UTXO by spending it via the owner path and
 * creating a new UTXO with a fresh timelock.
 *
 * This is the core "check-in" operation: the owner proves they're alive
 * by spending the current UTXO and creating a new one, resetting the
 * CSV timelock clock.
 */
export function refreshTimelockUTXO(params: {
  currentUtxo: { txId: string; outputIndex: number; amountSats: number }
  currentScript: Uint8Array
  ownerPrivkey: Uint8Array
  ownerPubkey: Uint8Array
  recipientPubkey: Uint8Array
  ttlBlocks: number
  feeRateSatsPerVbyte: number
  network: "mainnet" | "testnet"
}): RefreshResult {
  const {
    currentUtxo,
    currentScript,
    ownerPrivkey,
    ownerPubkey,
    recipientPubkey,
    ttlBlocks,
    feeRateSatsPerVbyte,
    network,
  } = params

  const net =
    network === "testnet" ? btc.TEST_NETWORK : btc.NETWORK
  const currentP2WSHScript = getP2WSHOutputScript(currentScript, network)

  // Create new timelock script (may have same or different TTL)
  const newTimelockScript = createCSVTimelockScript(
    ownerPubkey,
    recipientPubkey,
    ttlBlocks,
  )
  const newP2WSHScript = getP2WSHOutputScript(newTimelockScript, network)

  // Build the refresh transaction
  const tx = new btc.Transaction({
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  })

  // Input: current timelock UTXO (spending via owner/IF branch)
  tx.addInput({
    txid: currentUtxo.txId,
    index: currentUtxo.outputIndex,
    witnessUtxo: {
      amount: BigInt(currentUtxo.amountSats),
      script: currentP2WSHScript,
    },
    witnessScript: currentScript,
    sequence: 0xfffffffe, // No CSV constraint for owner path
  })

  // Estimate fee: P2WSH input ~150 vbytes, P2WSH output ~43 vbytes, overhead ~11 vbytes
  // Total ~204 vbytes
  const estimatedVbytes = 204
  const fee = Math.ceil(estimatedVbytes * feeRateSatsPerVbyte)

  // Output: new timelock UTXO (minus fee)
  const newAmount = currentUtxo.amountSats - fee
  if (newAmount < MIN_UTXO_SATS) {
    throw new Error(
      `After fee (${fee} sats), remaining amount ${newAmount} sats is below minimum ${MIN_UTXO_SATS} sats. ` +
        `Consider adding more funds or reducing fee rate.`,
    )
  }

  tx.addOutput({
    script: newP2WSHScript,
    amount: BigInt(newAmount),
  })

  // Sign with owner key
  tx.sign(ownerPrivkey)

  // Get the partial signature
  const input = tx.getInput(0)
  if (!input.partialSig || input.partialSig.length === 0) {
    throw new Error("Failed to generate signature for refresh transaction")
  }
  const sig = input.partialSig[0][1]

  // Build raw transaction with custom witness for IF (owner) branch:
  // witness = [<owner_sig>, <TRUE (0x01)>, <witnessScript>]
  const unsignedTxBytes = tx.unsignedTx
  const rawTx = btc.RawTx.decode(unsignedTxBytes)
  rawTx.segwitFlag = true
  rawTx.witnesses = [[sig, new Uint8Array([0x01]), currentScript]]

  const finalTxBytes = btc.RawTx.encode(rawTx)
  const txHex = hex.encode(finalTxBytes)

  // Compute txid from the non-witness serialization
  const newTxId = computeTxIdFromRaw(rawTx)

  return {
    txHex,
    newTxId,
    newOutputIndex: 0,
    newTimelockScript,
  }
}

/**
 * Compute txid from a decoded raw transaction.
 * txid = reversed double-SHA256 of the non-witness serialization.
 */
function computeTxIdFromRaw(
  rawTx: ReturnType<typeof btc.RawTx.decode>,
): string {
  const nonWitness = {
    ...rawTx,
    segwitFlag: false,
    witnesses: [],
  }
  const nonWitnessBytes = btc.RawTx.encode(nonWitness)
  const hash = sha256(sha256(nonWitnessBytes))
  const reversed = new Uint8Array(hash).reverse()
  return hex.encode(reversed)
}

/**
 * Estimate the number of refreshes possible before the UTXO is depleted.
 *
 * @param currentAmountSats - Current UTXO amount
 * @param feeRateSatsPerVbyte - Fee rate
 * @returns Estimated number of refreshes remaining
 */
export function estimateRefreshesRemaining(
  currentAmountSats: number,
  feeRateSatsPerVbyte: number,
): number {
  const feePerRefresh = Math.ceil(204 * feeRateSatsPerVbyte)
  let remaining = currentAmountSats
  let count = 0
  while (remaining - feePerRefresh >= MIN_UTXO_SATS) {
    remaining -= feePerRefresh
    count++
  }
  return count
}
