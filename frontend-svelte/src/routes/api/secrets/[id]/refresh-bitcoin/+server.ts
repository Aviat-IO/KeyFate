/**
 * POST /api/secrets/[id]/refresh-bitcoin
 *
 * Refreshes the Bitcoin UTXO (check-in). Spends the current UTXO
 * via the owner path and creates a new one with a fresh timelock.
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { refreshBitcoin } from "$lib/services/bitcoin-service"
import { hex } from "@scure/base"

export const POST: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const secretId = event.params.id
    const body = await event.request.json()

    // Validate required fields
    if (!body.ownerPrivkey) {
      return json(
        { error: "Missing required field: ownerPrivkey" },
        { status: 400 },
      )
    }
    if (!body.feeRateSatsPerVbyte || typeof body.feeRateSatsPerVbyte !== "number") {
      return json(
        { error: "Missing or invalid feeRateSatsPerVbyte" },
        { status: 400 },
      )
    }
    if (body.network !== "mainnet" && body.network !== "testnet") {
      return json(
        { error: "network must be 'mainnet' or 'testnet'" },
        { status: 400 },
      )
    }

    const result = await refreshBitcoin(secretId, session.user.id, {
      ownerPrivkey: hex.decode(body.ownerPrivkey),
      feeRateSatsPerVbyte: body.feeRateSatsPerVbyte,
      network: body.network,
    })

    return json(result)
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/refresh-bitcoin:", error)
    const message = error instanceof Error ? error.message : "Internal server error"

    if (message === "Secret not found") {
      return json({ error: message }, { status: 404 })
    }
    if (message === "No active Bitcoin UTXO found for this secret") {
      return json({ error: message }, { status: 404 })
    }
    if (message.includes("below minimum")) {
      return json({ error: message }, { status: 422 })
    }

    return json({ error: message }, { status: 500 })
  }
}
