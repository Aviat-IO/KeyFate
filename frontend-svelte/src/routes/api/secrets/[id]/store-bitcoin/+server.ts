/**
 * POST /api/secrets/[id]/store-bitcoin
 *
 * Stores the results of a client-side Bitcoin operation.
 * The client creates and broadcasts the transaction; this endpoint
 * only persists the resulting data (txId, scripts, pre-signed txs).
 *
 * No private keys are sent to the server.
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { hex } from "@scure/base"
import { eq, and } from "drizzle-orm"
import { getDatabase } from "$lib/db/get-database"
import { bitcoinUtxos, secrets } from "$lib/db/schema"

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
      "txId",
      "outputIndex",
      "amountSats",
      "timelockScript",
      "ownerPubkey",
      "recipientPubkey",
      "ttlBlocks",
      "preSignedRecipientTx",
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

    // Validate types
    if (typeof body.txId !== "string" || !/^[0-9a-f]{64}$/i.test(body.txId)) {
      return json(
        { error: "txId must be a 64-character hex string" },
        { status: 400 },
      )
    }
    if (typeof body.outputIndex !== "number" || body.outputIndex < 0) {
      return json(
        { error: "outputIndex must be a non-negative integer" },
        { status: 400 },
      )
    }
    if (typeof body.amountSats !== "number" || body.amountSats < 10000) {
      return json(
        { error: "amountSats must be at least 10000" },
        { status: 400 },
      )
    }
    if (typeof body.timelockScript !== "string") {
      return json(
        { error: "timelockScript must be a hex string" },
        { status: 400 },
      )
    }
    if (typeof body.ownerPubkey !== "string") {
      return json(
        { error: "ownerPubkey must be a hex string" },
        { status: 400 },
      )
    }
    if (typeof body.recipientPubkey !== "string") {
      return json(
        { error: "recipientPubkey must be a hex string" },
        { status: 400 },
      )
    }
    if (typeof body.ttlBlocks !== "number" || body.ttlBlocks < 1) {
      return json(
        { error: "ttlBlocks must be a positive integer" },
        { status: 400 },
      )
    }
    if (typeof body.preSignedRecipientTx !== "string") {
      return json(
        { error: "preSignedRecipientTx must be a hex string" },
        { status: 400 },
      )
    }
    if (body.network !== "mainnet" && body.network !== "testnet") {
      return json(
        { error: "network must be 'mainnet' or 'testnet'" },
        { status: 400 },
      )
    }

    const db = await getDatabase()

    // Verify the secret exists and belongs to the user
    const [secret] = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, secretId), eq(secrets.userId, session.user.id)))

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    // Check for existing active UTXO
    const [existingUtxo] = await db
      .select()
      .from(bitcoinUtxos)
      .where(
        and(
          eq(bitcoinUtxos.secretId, secretId),
          eq(bitcoinUtxos.status, "confirmed"),
        ),
      )

    if (existingUtxo) {
      return json(
        { error: "Bitcoin is already enabled for this secret" },
        { status: 409 },
      )
    }

    // Store the UTXO data
    const [utxoRecord] = await db
      .insert(bitcoinUtxos)
      .values({
        secretId,
        txId: body.txId,
        outputIndex: body.outputIndex,
        amountSats: body.amountSats,
        timelockScript: body.timelockScript,
        ownerPubkey: body.ownerPubkey,
        recipientPubkey: body.recipientPubkey,
        ttlBlocks: body.ttlBlocks,
        status: "pending",
        preSignedRecipientTx: body.preSignedRecipientTx,
      })
      .returning()

    return json(
      {
        utxoId: utxoRecord.id,
        txId: body.txId,
        outputIndex: body.outputIndex,
        amountSats: body.amountSats,
        ttlBlocks: body.ttlBlocks,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/store-bitcoin:", error)
    const message =
      error instanceof Error ? error.message : "Internal server error"
    return json({ error: message }, { status: 500 })
  }
}
