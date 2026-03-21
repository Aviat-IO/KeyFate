import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { authorizeRequest, sanitizeError } from "$lib/cron/utils"
import { runCheckSecrets } from "$lib/cron/check-secrets"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "check-secrets" })
}

export const POST: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runCheckSecrets()
    return json(result)
  } catch (error) {
    const errorDetails = {
      error: "Database operation failed",
      message: sanitizeError(error),
      timestamp: new Date().toISOString(),
    }
    return json(errorDetails, { status: 500 })
  }
}
