/**
 * Core logic for the process-deletions cron job.
 *
 * Finds account deletions past their grace period and executes them.
 */

import { logger } from "$lib/logger"
import {
  getPendingDeletions,
  executeAccountDeletion,
} from "$lib/gdpr/deletion-service"

export interface ProcessDeletionsResult {
  success: boolean
  processed: number
  succeeded: number
  failed: number
  successCount: number
  failureCount: number
  message?: string
}

export async function runProcessDeletions(): Promise<ProcessDeletionsResult> {
  logger.info("Processing account deletions")

  // Get deletions past grace period
  const pendingDeletions = await getPendingDeletions()

  if (pendingDeletions.length === 0) {
    logger.info("No pending deletions found")
    return {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      successCount: 0,
      failureCount: 0,
      message: "No pending deletions",
    }
  }

  logger.info("Found pending deletions", { count: pendingDeletions.length })

  let successCount = 0
  let failureCount = 0

  // Process each deletion
  for (const deletion of pendingDeletions) {
    try {
      logger.info("Processing deletion", { deletionId: deletion.id, userId: deletion.userId })

      await executeAccountDeletion(deletion.userId)

      successCount++
      logger.info("Account deletion completed", { deletionId: deletion.id })
    } catch (error) {
      logger.error("Error processing deletion", error instanceof Error ? error : undefined, { deletionId: deletion.id })
      failureCount++
    }
  }

  logger.info("Deletion processing complete", { successCount, failureCount })

  return {
    success: true,
    processed: pendingDeletions.length,
    succeeded: successCount,
    failed: failureCount,
    successCount,
    failureCount,
  }
}
