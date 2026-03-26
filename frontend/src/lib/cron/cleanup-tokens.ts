/**
 * Core logic for the cleanup-tokens cron job.
 *
 * Deletes expired CSRF tokens from the database.
 */

import { getDatabase } from "$lib/db/get-database"
import { csrfTokens } from "$lib/db/schema"
import { lt } from "drizzle-orm"
import { logger } from "$lib/logger"

export interface CleanupTokensResult {
  success: boolean
  processed: number
  succeeded: number
  failed: number
  deletedCount: number
  timestamp: string
}

export async function runCleanupTokens(): Promise<CleanupTokensResult> {
  const db = await getDatabase()
  const now = new Date()

  const deletedTokens = await db
    .delete(csrfTokens)
    .where(lt(csrfTokens.expiresAt, now))
    .returning({ id: csrfTokens.id })

  logger.info("Cleaned up expired CSRF tokens", {
    deletedCount: deletedTokens.length,
    timestamp: now.toISOString(),
  })

  return {
    success: true,
    processed: deletedTokens.length,
    succeeded: deletedTokens.length,
    failed: 0,
    deletedCount: deletedTokens.length,
    timestamp: now.toISOString(),
  }
}
