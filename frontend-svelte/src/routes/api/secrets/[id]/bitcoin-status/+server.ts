/**
 * GET /api/secrets/[id]/bitcoin-status
 *
 * Returns the Bitcoin UTXO status for a secret, including
 * time remaining, refreshes remaining, and confirmation status.
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getBitcoinStatus } from "$lib/services/bitcoin-service"

export const GET: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const secretId = event.params.id
    const status = await getBitcoinStatus(secretId, session.user.id)

    return json(status)
  } catch (error) {
    console.error("Error in GET /api/secrets/[id]/bitcoin-status:", error)
    const message = error instanceof Error ? error.message : "Internal server error"

    if (message === "Secret not found") {
      return json({ error: message }, { status: 404 })
    }

    return json({ error: message }, { status: 500 })
  }
}
