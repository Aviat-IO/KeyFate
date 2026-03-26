import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { runProcessSubscriptionDowngrades } from "$lib/cron/process-subscription-downgrades"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({
    status: "ok",
    job: "process-subscription-downgrades",
  })
}

export const POST: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runProcessSubscriptionDowngrades()
    return json(result)
  } catch (error) {
    logger.error("process-downgrades fatal error", error instanceof Error ? error : undefined)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return json(
      {
        error: "Failed to process downgrades",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
