import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest, sanitizeError } from "$lib/cron/utils"
import { runProcessReminders } from "$lib/cron/process-reminders"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "process-reminders" })
}

export const POST: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runProcessReminders()
    return json(result)
  } catch (error) {
    logger.error("process-reminders error", undefined, {
      error: sanitizeError(error),
    })

    return json(
      {
        error: "Database operation failed",
        message: sanitizeError(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
