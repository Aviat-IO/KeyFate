import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { runProcessExports } from "$lib/cron/process-exports"

/**
 * GET /api/cron/process-exports
 * Health check endpoint for monitoring
 */
export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "process-exports" })
}

/**
 * POST /api/cron/process-exports
 * Process pending data export jobs
 */
export const POST: RequestHandler = async (event) => {
  try {
    if (!authorizeRequest(event.request, event.url)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await runProcessExports()
    return json(result)
  } catch (error) {
    logger.error("Error in process-exports", error instanceof Error ? error : undefined)
    return json(
      { error: "Failed to process exports" },
      { status: 500 },
    )
  }
}
