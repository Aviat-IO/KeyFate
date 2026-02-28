/**
 * Bitcoin service layer for the dead man's switch.
 *
 * Orchestrates Bitcoin UTXO lifecycle: creation, refresh (check-in),
 * status queries, and pre-signed recipient transaction storage.
 */

import { hex } from "@scure/base"
import { eq, and, desc } from "drizzle-orm"
import { getDatabase } from "$lib/db/get-database"
import { bitcoinUtxos, secrets } from "$lib/db/schema"
import type { BitcoinUtxo } from "$lib/db/schema"
import {
  createTimelockUTXO,
  createPreSignedRecipientTx,
  type UTXO,
} from "$lib/bitcoin/transaction"
import { refreshTimelockUTXO, estimateRefreshesRemaining } from "$lib/bitcoin/refresh"
import { broadcastTransaction, getUTXOStatus } from "$lib/bitcoin/broadcast"
import { daysToBlocks, blocksToApproxDays } from "$lib/bitcoin/script"

/** Parameters for enabling Bitcoin on a secret */
export interface EnableBitcoinParams {
  ownerPrivkey: Uint8Array
  ownerPubkey: Uint8Array
  recipientPubkey: Uint8Array
  fundingUtxo: UTXO
  amountSats: number
  feeRateSatsPerVbyte: number
  /** Symmetric key K for OP_RETURN (from Nostr publishing) */
  symmetricKeyK: Uint8Array
  /** Nostr event ID for OP_RETURN */
  nostrEventId: string
  /** Recipient's Bitcoin address for the pre-signed tx */
  recipientAddress: string
  /** Recipient's private key for signing the pre-signed tx */
  recipientPrivkey: Uint8Array
  network: "mainnet" | "testnet"
}

/** Parameters for refreshing a Bitcoin UTXO */
export interface RefreshBitcoinParams {
  ownerPrivkey: Uint8Array
  feeRateSatsPerVbyte: number
  network: "mainnet" | "testnet"
}

/** Result of enabling Bitcoin */
export interface EnableBitcoinResult {
  utxoId: string
  txId: string
  outputIndex: number
  amountSats: number
  ttlBlocks: number
  preSignedRecipientTx: string
}

/** Result of refreshing Bitcoin */
export interface RefreshBitcoinResult {
  utxoId: string
  newTxId: string
  newOutputIndex: number
  newAmountSats: number
  ttlBlocks: number
  refreshesRemaining: number
}

/** Bitcoin status for a secret */
export interface BitcoinStatus {
  enabled: boolean
  utxo: {
    id: string
    txId: string
    outputIndex: number
    amountSats: number
    ttlBlocks: number
    status: string
    confirmedAt: Date | null
    createdAt: Date
  } | null
  /** Estimated time remaining in days (based on block height) */
  estimatedDaysRemaining: number | null
  /** Estimated refreshes remaining at current fee rate */
  refreshesRemaining: number | null
  /** Whether a pre-signed recipient tx exists */
  hasPreSignedTx: boolean
}

/**
 * Enable Bitcoin dead man's switch for a secret.
 *
 * Creates a CSV timelock UTXO, broadcasts it, creates a pre-signed
 * recipient transaction, and stores everything in the database.
 */
export async function enableBitcoin(
  secretId: string,
  userId: string,
  params: EnableBitcoinParams,
): Promise<EnableBitcoinResult> {
  const db = await getDatabase()

  // Verify the secret exists and belongs to the user
  const [secret] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)))

  if (!secret) {
    throw new Error("Secret not found")
  }

  // Check for existing active UTXO
  const [existingUtxo] = await db
    .select()
    .from(bitcoinUtxos)
    .where(
      and(
        eq(bitcoinUtxos.secretId, secretId),
        eq(bitcoinUtxos.status, "confirmed"),
      ),
    )

  if (existingUtxo) {
    throw new Error("Bitcoin is already enabled for this secret")
  }

  // Convert check-in days to blocks
  const ttlBlocks = daysToBlocks(secret.checkInDays)

  // 1. Create the timelock UTXO transaction
  const utxoResult = createTimelockUTXO({
    ownerPrivkey: params.ownerPrivkey,
    ownerPubkey: params.ownerPubkey,
    recipientPubkey: params.recipientPubkey,
    ttlBlocks,
    amountSats: params.amountSats,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    fundingUtxo: params.fundingUtxo,
    network: params.network,
  })

  // 2. Broadcast the transaction
  const broadcastTxId = await broadcastTransaction(utxoResult.txHex, params.network)

  // 3. Create the pre-signed recipient transaction
  const preSignedResult = createPreSignedRecipientTx({
    timelockUtxo: {
      txId: broadcastTxId,
      outputIndex: utxoResult.outputIndex,
      amountSats: params.amountSats,
    },
    timelockScript: utxoResult.timelockScript,
    recipientPrivkey: params.recipientPrivkey,
    recipientAddress: params.recipientAddress,
    ttlBlocks,
    symmetricKeyK: params.symmetricKeyK,
    nostrEventId: params.nostrEventId,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    network: params.network,
  })

  // 4. Store in database
  const [utxoRecord] = await db
    .insert(bitcoinUtxos)
    .values({
      secretId,
      txId: broadcastTxId,
      outputIndex: utxoResult.outputIndex,
      amountSats: params.amountSats,
      timelockScript: hex.encode(utxoResult.timelockScript),
      ownerPubkey: hex.encode(params.ownerPubkey),
      recipientPubkey: hex.encode(params.recipientPubkey),
      ttlBlocks,
      status: "pending",
      preSignedRecipientTx: preSignedResult.txHex,
    })
    .returning()

  return {
    utxoId: utxoRecord.id,
    txId: broadcastTxId,
    outputIndex: utxoResult.outputIndex,
    amountSats: params.amountSats,
    ttlBlocks,
    preSignedRecipientTx: preSignedResult.txHex,
  }
}

/**
 * Refresh (check-in) the Bitcoin UTXO for a secret.
 *
 * Spends the current UTXO via the owner path and creates a new one
 * with a fresh CSV timelock, resetting the dead man's switch clock.
 */
export async function refreshBitcoin(
  secretId: string,
  userId: string,
  params: RefreshBitcoinParams,
): Promise<RefreshBitcoinResult> {
  const db = await getDatabase()

  // Verify the secret exists and belongs to the user
  const [secret] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)))

  if (!secret) {
    throw new Error("Secret not found")
  }

  // Get the current active UTXO
  const [currentUtxo] = await db
    .select()
    .from(bitcoinUtxos)
    .where(
      and(
        eq(bitcoinUtxos.secretId, secretId),
        eq(bitcoinUtxos.status, "confirmed"),
      ),
    )
    .orderBy(desc(bitcoinUtxos.createdAt))

  if (!currentUtxo) {
    throw new Error("No active Bitcoin UTXO found for this secret")
  }

  const ttlBlocks = daysToBlocks(secret.checkInDays)
  const currentScript = hex.decode(currentUtxo.timelockScript)
  const ownerPubkey = hex.decode(currentUtxo.ownerPubkey)
  const recipientPubkey = hex.decode(currentUtxo.recipientPubkey)

  // 1. Create the refresh transaction
  const refreshResult = refreshTimelockUTXO({
    currentUtxo: {
      txId: currentUtxo.txId,
      outputIndex: currentUtxo.outputIndex,
      amountSats: currentUtxo.amountSats,
    },
    currentScript,
    ownerPrivkey: params.ownerPrivkey,
    ownerPubkey,
    recipientPubkey,
    ttlBlocks,
    feeRateSatsPerVbyte: params.feeRateSatsPerVbyte,
    network: params.network,
  })

  // 2. Broadcast the refresh transaction
  const newTxId = await broadcastTransaction(refreshResult.txHex, params.network)

  // Calculate new amount (original minus fee)
  const estimatedFee = Math.ceil(204 * params.feeRateSatsPerVbyte)
  const newAmountSats = currentUtxo.amountSats - estimatedFee

  // 3. Mark old UTXO as spent
  await db
    .update(bitcoinUtxos)
    .set({
      status: "spent",
      spentAt: new Date(),
      spentByTxId: newTxId,
      updatedAt: new Date(),
    })
    .where(eq(bitcoinUtxos.id, currentUtxo.id))

  // 4. Insert new UTXO record
  const [newUtxoRecord] = await db
    .insert(bitcoinUtxos)
    .values({
      secretId,
      txId: newTxId,
      outputIndex: refreshResult.newOutputIndex,
      amountSats: newAmountSats,
      timelockScript: hex.encode(refreshResult.newTimelockScript),
      ownerPubkey: currentUtxo.ownerPubkey,
      recipientPubkey: currentUtxo.recipientPubkey,
      ttlBlocks,
      status: "pending",
      // Pre-signed tx needs to be recreated for the new UTXO
      // This would be done by the recipient or a separate process
      preSignedRecipientTx: null,
    })
    .returning()

  const refreshesRemaining = estimateRefreshesRemaining(
    newAmountSats,
    params.feeRateSatsPerVbyte,
  )

  return {
    utxoId: newUtxoRecord.id,
    newTxId,
    newOutputIndex: refreshResult.newOutputIndex,
    newAmountSats,
    ttlBlocks,
    refreshesRemaining,
  }
}

/**
 * Get the Bitcoin status for a secret.
 */
export async function getBitcoinStatus(
  secretId: string,
  userId: string,
): Promise<BitcoinStatus> {
  const db = await getDatabase()

  // Verify the secret exists and belongs to the user
  const [secret] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)))

  if (!secret) {
    throw new Error("Secret not found")
  }

  // Get the latest UTXO (active or pending)
  const [latestUtxo] = await db
    .select()
    .from(bitcoinUtxos)
    .where(eq(bitcoinUtxos.secretId, secretId))
    .orderBy(desc(bitcoinUtxos.createdAt))

  if (!latestUtxo) {
    return {
      enabled: false,
      utxo: null,
      estimatedDaysRemaining: null,
      refreshesRemaining: null,
      hasPreSignedTx: false,
    }
  }

  // Estimate days remaining based on TTL blocks
  const estimatedDaysRemaining =
    latestUtxo.status === "confirmed" || latestUtxo.status === "pending"
      ? blocksToApproxDays(latestUtxo.ttlBlocks)
      : null

  // Estimate refreshes remaining at a default fee rate of 10 sat/vbyte
  const refreshesRemaining =
    latestUtxo.status === "confirmed" || latestUtxo.status === "pending"
      ? estimateRefreshesRemaining(latestUtxo.amountSats, 10)
      : null

  return {
    enabled: true,
    utxo: {
      id: latestUtxo.id,
      txId: latestUtxo.txId,
      outputIndex: latestUtxo.outputIndex,
      amountSats: latestUtxo.amountSats,
      ttlBlocks: latestUtxo.ttlBlocks,
      status: latestUtxo.status,
      confirmedAt: latestUtxo.confirmedAt,
      createdAt: latestUtxo.createdAt,
    },
    estimatedDaysRemaining,
    refreshesRemaining,
    hasPreSignedTx: !!latestUtxo.preSignedRecipientTx,
  }
}

/**
 * Get the active (confirmed) Bitcoin UTXO for a secret, if any.
 * Used by the check-in flow to determine if Bitcoin refresh is needed.
 */
export async function getActiveUtxo(
  secretId: string,
): Promise<BitcoinUtxo | null> {
  const db = await getDatabase()

  const [utxo] = await db
    .select()
    .from(bitcoinUtxos)
    .where(
      and(
        eq(bitcoinUtxos.secretId, secretId),
        eq(bitcoinUtxos.status, "confirmed"),
      ),
    )
    .orderBy(desc(bitcoinUtxos.createdAt))

  return utxo ?? null
}
