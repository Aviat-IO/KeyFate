/**
 * Core logic for the confirm-utxos cron job.
 *
 * Checks pending Bitcoin UTXOs against mempool.space and updates
 * their status to "confirmed" when the transaction is mined.
 */

import { getDatabase } from "$lib/db/drizzle"
import { bitcoinUtxos } from "$lib/db/schema"
import { eq } from "drizzle-orm"
import { logger } from "$lib/logger"
import { getUTXOStatus } from "$lib/bitcoin/broadcast"

/** Max UTXOs to process per run to avoid hammering mempool.space */
export const MAX_UTXOS_PER_RUN = 10

export interface ConfirmUtxosResult {
  success: boolean
  processed: number
  succeeded: number
  failed: number
  stillPending: number
  message?: string
  errors?: string[]
}

export async function confirmPendingUtxos(): Promise<ConfirmUtxosResult> {
  const db = await getDatabase()

  // Query all pending UTXOs, limited to MAX_UTXOS_PER_RUN
  const pendingUtxos = await db
    .select()
    .from(bitcoinUtxos)
    .where(eq(bitcoinUtxos.status, "pending"))
    .limit(MAX_UTXOS_PER_RUN)

  if (pendingUtxos.length === 0) {
    return {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      stillPending: 0,
      message: "No pending UTXOs to check",
    }
  }

  let confirmed = 0
  let stillPending = 0
  let failed = 0
  const errors: string[] = []

  for (const utxo of pendingUtxos) {
    try {
      // TODO: The UTXO record doesn't store the network. Defaulting to "mainnet".
      // This should be made configurable or stored per-UTXO when multi-network support is added.
      const status = await getUTXOStatus(utxo.txId, utxo.outputIndex, "mainnet")

      if (status.confirmed) {
        await db
          .update(bitcoinUtxos)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bitcoinUtxos.id, utxo.id))

        confirmed++
      } else {
        stillPending++
      }
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`UTXO ${utxo.id} (tx: ${utxo.txId}): ${message}`)
      logger.error("Failed to check UTXO status", {
        utxoId: utxo.id,
        txId: utxo.txId,
        error: message,
      })
    }
  }

  logger.info("UTXO confirmation check completed", {
    processed: pendingUtxos.length,
    confirmed,
    stillPending,
    failed,
  })

  return {
    success: true,
    processed: pendingUtxos.length,
    succeeded: confirmed,
    failed,
    stillPending,
    ...(errors.length > 0 && { errors }),
  }
}
