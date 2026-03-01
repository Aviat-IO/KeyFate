import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { adaptRequestEvent } from "$lib/cron/adapt-request"
import { confirmPendingUtxos } from "$lib/cron/confirm-utxos"

export const GET: RequestHandler = async (event) => {
  const req = adaptRequestEvent(event)
  if (!authorizeRequest(req)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "confirm-utxos" })
}

export const POST: RequestHandler = async (event) => {
  try {
    const req = adaptRequestEvent(event)
    if (!authorizeRequest(req)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await confirmPendingUtxos()
    return json(result)
  } catch (error) {
    logger.error("Failed to run UTXO confirmation check", error as Error)
    return json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
