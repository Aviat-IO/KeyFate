import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import {
  getPendingDeletions,
  executeAccountDeletion,
} from "$lib/gdpr/deletion-service"

/**
 * GET /api/cron/process-deletions
 * Health check endpoint for monitoring
 */
export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "process-deletions" })
}

/**
 * POST /api/cron/process-deletions
 * Execute account deletions that are past grace period
 */
export const POST: RequestHandler = async (event) => {
  try {
    if (!authorizeRequest(event.request, event.url)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    logger.info("Processing account deletions")

    // Get deletions past grace period
    const pendingDeletions = await getPendingDeletions()

    if (pendingDeletions.length === 0) {
      logger.info("No pending deletions found")
      return json({
        success: true,
        processed: 0,
        message: "No pending deletions",
      })
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

    return json({
      success: true,
      processed: pendingDeletions.length,
      successCount,
      failureCount,
    })
  } catch (error) {
    logger.error("Error in process-deletions", error instanceof Error ? error : undefined)
    return json(
      { error: "Failed to process deletions" },
      { status: 500 },
    )
  }
}
