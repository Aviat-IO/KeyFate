import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { runProcessDeletions } from "$lib/cron/process-deletions"

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

    const result = await runProcessDeletions()
    return json(result)
  } catch (error) {
    logger.error("Error in process-deletions", error instanceof Error ? error : undefined)
    return json(
      { error: "Failed to process deletions" },
      { status: 500 },
    )
  }
}
