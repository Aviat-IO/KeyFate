import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { runCleanupExports } from "$lib/cron/cleanup-exports"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "cleanup-exports" })
}

export const POST: RequestHandler = async (event) => {
  try {
    if (!authorizeRequest(event.request, event.url)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await runCleanupExports()
    return json(result)
  } catch (error) {
    logger.error("Error in cleanup-exports", error instanceof Error ? error : undefined)
    return json(
      { error: "Failed to cleanup exports" },
      { status: 500 },
    )
  }
}
