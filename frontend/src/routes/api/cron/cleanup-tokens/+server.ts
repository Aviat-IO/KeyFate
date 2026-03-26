import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { runCleanupTokens } from "$lib/cron/cleanup-tokens"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "cleanup-tokens" })
}

export const POST: RequestHandler = async (event) => {
  try {
    if (!authorizeRequest(event.request, event.url)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await runCleanupTokens()
    return json(result)
  } catch (error) {
    logger.error("Failed to cleanup CSRF tokens", error as Error)
    return json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
