/**
 * Bitcoin transaction construction for the dead man's switch.
 *
 * Creates timelock UTXOs and pre-signed recipient transactions.
 * Uses @scure/btc-signer for transaction building and signing.
 */

import * as btc from "@scure/btc-signer"
import { hex } from "@scure/base"
import { sha256 } from "@noble/hashes/sha2.js"
import {
  createCSVTimelockScript,
  createOpReturnPayload,
  createOpReturnScript,
  getP2WSHOutputScript,
  MIN_UTXO_SATS,
} from "./script.js"

/** A UTXO reference for spending */
export interface UTXO {
  txId: string
  outputIndex: number
  amountSats: number
  /** The scriptPubKey of this output (hex-encoded) */
  scriptPubKey: string
}

/** Result of creating a timelock UTXO */
export interface TimelockUTXOResult {
  /** Serialized transaction hex */
  txHex: string
  /** Transaction ID */
  txId: string
  /** Output index of the timelock UTXO */
  outputIndex: number
  /** The timelock witness script (for spending later) */
  timelockScript: Uint8Array
}

/** Result of creating a pre-signed recipient transaction */
export interface PreSignedRecipientTxResult {
  /** Serialized transaction hex (becomes valid after CSV timeout) */
  txHex: string
}

function getNetwork(
  network: "mainnet" | "testnet",
): typeof btc.NETWORK | typeof btc.TEST_NETWORK {
  return network === "testnet" ? btc.TEST_NETWORK : btc.NETWORK
}

/**
 * Compute the txid from a raw transaction (non-witness serialization).
 * txid = reversed double-SHA256 of the non-witness serialized tx.
 */
function computeTxId(rawTxBytes: Uint8Array): string {
  // For witness transactions, we need the non-witness serialization for txid.
  // Decode and re-encode without witness data.
  const decoded = btc.RawTx.decode(rawTxBytes)
  const nonWitness = {
    ...decoded,
    segwitFlag: false,
    witnesses: [],
  }
  const nonWitnessBytes = btc.RawTx.encode(nonWitness)
  const hash = sha256(sha256(nonWitnessBytes))
  // Reverse for txid (Bitcoin uses little-endian display)
  const reversed = new Uint8Array(hash).reverse()
  return hex.encode(reversed)
}

/**
 * Create a transaction that funds a CSV timelock UTXO.
 *
 * This creates a P2WSH output containing the CSV timelock script.
 * The owner can spend it at any time; the recipient can spend after the timeout.
 *
 * @returns Transaction hex, txid, output index, and the timelock script
 */
export function createTimelockUTXO(params: {
  ownerPrivkey: Uint8Array
  ownerPubkey: Uint8Array
  recipientPubkey: Uint8Array
  ttlBlocks: number
  amountSats: number
  feeRateSatsPerVbyte: number
  fundingUtxo: UTXO
  network: "mainnet" | "testnet"
}): TimelockUTXOResult {
  const {
    ownerPrivkey,
    ownerPubkey,
    recipientPubkey,
    ttlBlocks,
    amountSats,
    feeRateSatsPerVbyte,
    fundingUtxo,
    network,
  } = params

  if (amountSats < MIN_UTXO_SATS) {
    throw new Error(
      `Amount ${amountSats} sats is below minimum ${MIN_UTXO_SATS} sats`,
    )
  }

  // Create the timelock script
  const timelockScript = createCSVTimelockScript(
    ownerPubkey,
    recipientPubkey,
    ttlBlocks,
  )

  // Get the P2WSH output script
  const p2wshOutputScript = getP2WSHOutputScript(timelockScript, network)

  // Build the transaction
  const tx = new btc.Transaction({
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  })

  // Add funding input (P2WPKH from owner)
  const p2wpkh = btc.p2wpkh(ownerPubkey, getNetwork(network))
  tx.addInput({
    txid: fundingUtxo.txId,
    index: fundingUtxo.outputIndex,
    witnessUtxo: {
      amount: BigInt(fundingUtxo.amountSats),
      script: p2wpkh.script,
    },
    sequence: 0xfffffffe, // Enable RBF, no CSV constraint on this input
  })

  // Output 0: Timelock P2WSH
  tx.addOutput({
    script: p2wshOutputScript,
    amount: BigInt(amountSats),
  })

  // Estimate fee: P2WPKH input ~68 vbytes, P2WSH output ~43 vbytes, overhead ~11 vbytes
  // Total ~122 vbytes for 1-in-1-out, add change output ~31 vbytes = ~153 vbytes
  const estimatedVbytes = 153
  const fee = Math.ceil(estimatedVbytes * feeRateSatsPerVbyte)

  // Change output (back to owner P2WPKH)
  const change = fundingUtxo.amountSats - amountSats - fee
  if (change < 0) {
    throw new Error(
      `Insufficient funds: need ${amountSats + fee} sats, have ${fundingUtxo.amountSats} sats`,
    )
  }
  if (change > 546) {
    // Only add change if above dust threshold
    tx.addOutput({
      script: p2wpkh.script,
      amount: BigInt(change),
    })
  }

  // Sign the funding input (P2WPKH)
  tx.sign(ownerPrivkey)
  tx.finalize()

  const txHex = tx.hex
  const txId = tx.id

  return {
    txHex,
    txId,
    outputIndex: 0,
    timelockScript,
  }
}

/**
 * Create a pre-signed transaction that the recipient can broadcast
 * after the CSV timelock expires.
 *
 * This transaction:
 * - Spends the timelock UTXO via the ELSE (recipient) branch
 * - Sends funds to the recipient's address
 * - Includes an OP_RETURN with encrypted key K + Nostr event ID
 *
 * The transaction is pre-signed but only becomes valid after ttlBlocks
 * confirmations of the timelock UTXO.
 */
export function createPreSignedRecipientTx(params: {
  timelockUtxo: { txId: string; outputIndex: number; amountSats: number }
  timelockScript: Uint8Array
  recipientPrivkey: Uint8Array
  recipientAddress: string
  ttlBlocks: number
  symmetricKeyK: Uint8Array
  nostrEventId: string
  feeRateSatsPerVbyte: number
  network: "mainnet" | "testnet"
}): PreSignedRecipientTxResult {
  const {
    timelockUtxo,
    timelockScript,
    recipientPrivkey,
    recipientAddress,
    ttlBlocks,
    symmetricKeyK,
    nostrEventId,
    feeRateSatsPerVbyte,
    network,
  } = params

  const net = getNetwork(network)
  const p2wshOutputScript = getP2WSHOutputScript(timelockScript, network)

  // Build the transaction
  const tx = new btc.Transaction({
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  })

  // Add the timelock UTXO as input with CSV sequence
  tx.addInput({
    txid: timelockUtxo.txId,
    index: timelockUtxo.outputIndex,
    witnessUtxo: {
      amount: BigInt(timelockUtxo.amountSats),
      script: p2wshOutputScript,
    },
    witnessScript: timelockScript,
    // CSV sequence: the lower 16 bits encode the relative lock time in blocks
    sequence: ttlBlocks,
  })

  // OP_RETURN output with encrypted key + Nostr event ID
  const opReturnPayload = createOpReturnPayload(symmetricKeyK, nostrEventId)
  const opReturnScript = createOpReturnScript(opReturnPayload)
  tx.addOutput({ script: opReturnScript, amount: 0n })

  // Estimate fee: P2WSH input ~150 vbytes (with witness), OP_RETURN ~75 vbytes,
  // P2WPKH output ~31 vbytes, overhead ~11 vbytes = ~267 vbytes
  const estimatedVbytes = 267
  const fee = Math.ceil(estimatedVbytes * feeRateSatsPerVbyte)

  // Recipient output (remaining after fee)
  const recipientAmount = timelockUtxo.amountSats - fee
  if (recipientAmount < 546) {
    throw new Error(
      `Timelock UTXO amount ${timelockUtxo.amountSats} sats too small to cover fee ${fee} sats`,
    )
  }
  tx.addOutputAddress(recipientAddress, BigInt(recipientAmount), net)

  // Sign with recipient key
  tx.sign(recipientPrivkey)

  // Get the partial signature for the recipient
  const input = tx.getInput(0)
  if (!input.partialSig || input.partialSig.length === 0) {
    throw new Error("Failed to generate signature for recipient transaction")
  }
  const sig = input.partialSig[0][1]

  // Build raw transaction with custom witness for ELSE branch:
  // witness = [<recipient_sig>, <FALSE (empty bytes)>, <witnessScript>]
  const unsignedTxBytes = tx.unsignedTx
  const rawTx = btc.RawTx.decode(unsignedTxBytes)
  rawTx.segwitFlag = true
  rawTx.witnesses = [[sig, new Uint8Array(0), timelockScript]]

  const finalTxBytes = btc.RawTx.encode(rawTx)
  const txHex = hex.encode(finalTxBytes)

  return { txHex }
}

/**
 * Estimate the virtual size (vbytes) of a timelock UTXO creation transaction.
 * Useful for fee estimation before building the actual transaction.
 *
 * Assumes: 1 P2WPKH input, 1 P2WSH output, 1 P2WPKH change output.
 */
export function estimateTimelockCreationVbytes(): number {
  return 153
}

/**
 * Estimate the virtual size (vbytes) of a recipient spending transaction.
 * Assumes: 1 P2WSH input (CSV timelock), 1 OP_RETURN output, 1 P2WPKH output.
 */
export function estimateRecipientSpendVbytes(): number {
  return 267
}
