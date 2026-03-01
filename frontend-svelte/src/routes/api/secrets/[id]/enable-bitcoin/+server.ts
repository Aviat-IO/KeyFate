/**
 * POST /api/secrets/[id]/enable-bitcoin
 *
 * @deprecated Use POST /api/secrets/[id]/store-bitcoin instead.
 * This endpoint requires sending private keys over HTTP, which is a security flaw.
 * The new flow performs all key operations client-side and only sends results
 * to the server via store-bitcoin.
 *
 * Creates a CSV timelocked UTXO for the dead man's switch.
 * Requires the owner's Bitcoin keys and a funding UTXO.
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { enableBitcoin } from "$lib/services/bitcoin-service"
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
    const requiredFields = [
      "ownerPrivkey",
      "ownerPubkey",
      "recipientPubkey",
      "fundingUtxo",
      "amountSats",
      "feeRateSatsPerVbyte",
      "symmetricKeyK",
      "nostrEventId",
      "recipientAddress",
      "recipientPrivkey",
      "network",
    ]

    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        )
      }
    }

    // Validate funding UTXO structure
    const { fundingUtxo } = body
    if (
      !fundingUtxo.txId ||
      fundingUtxo.outputIndex === undefined ||
      !fundingUtxo.amountSats ||
      !fundingUtxo.scriptPubKey
    ) {
      return json(
        { error: "Invalid fundingUtxo: requires txId, outputIndex, amountSats, scriptPubKey" },
        { status: 400 },
      )
    }

    // Validate network
    if (body.network !== "mainnet" && body.network !== "testnet") {
      return json(
        { error: "network must be 'mainnet' or 'testnet'" },
        { status: 400 },
      )
    }

    // Validate amount
    if (typeof body.amountSats !== "number" || body.amountSats < 10000) {
      return json(
        { error: "amountSats must be at least 10000" },
        { status: 400 },
      )
    }

    const result = await enableBitcoin(secretId, session.user.id, {
      ownerPrivkey: hex.decode(body.ownerPrivkey),
      ownerPubkey: hex.decode(body.ownerPubkey),
      recipientPubkey: hex.decode(body.recipientPubkey),
      fundingUtxo: {
        txId: fundingUtxo.txId,
        outputIndex: fundingUtxo.outputIndex,
        amountSats: fundingUtxo.amountSats,
        scriptPubKey: fundingUtxo.scriptPubKey,
      },
      amountSats: body.amountSats,
      feeRateSatsPerVbyte: body.feeRateSatsPerVbyte,
      symmetricKeyK: hex.decode(body.symmetricKeyK),
      nostrEventId: body.nostrEventId,
      recipientAddress: body.recipientAddress,
      recipientPrivkey: hex.decode(body.recipientPrivkey),
      network: body.network,
    })

    return json(result, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/enable-bitcoin:", error)
    const message = error instanceof Error ? error.message : "Internal server error"

    if (message === "Secret not found") {
      return json({ error: message }, { status: 404 })
    }
    if (message === "Bitcoin is already enabled for this secret") {
      return json({ error: message }, { status: 409 })
    }

    return json({ error: message }, { status: 500 })
  }
}
