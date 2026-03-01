/**
 * POST /api/secrets/[id]/store-bitcoin-refresh
 *
 * Stores the results of a client-side Bitcoin refresh (check-in).
 * Marks the old UTXO as spent and inserts the new UTXO data.
 *
 * No private keys are sent to the server.
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { eq, and, desc } from "drizzle-orm"
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
      "newTxId",
      "newOutputIndex",
      "newAmountSats",
      "newTimelockScript",
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
    if (typeof body.newTxId !== "string" || !/^[0-9a-f]{64}$/i.test(body.newTxId)) {
      return json(
        { error: "newTxId must be a 64-character hex string" },
        { status: 400 },
      )
    }
    if (typeof body.newOutputIndex !== "number" || body.newOutputIndex < 0) {
      return json(
        { error: "newOutputIndex must be a non-negative integer" },
        { status: 400 },
      )
    }
    if (typeof body.newAmountSats !== "number" || body.newAmountSats < 1) {
      return json(
        { error: "newAmountSats must be a positive integer" },
        { status: 400 },
      )
    }
    if (typeof body.newTimelockScript !== "string") {
      return json(
        { error: "newTimelockScript must be a hex string" },
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

    // Get the current active UTXO to mark as spent
    const [currentUtxo] = await db
      .select()
      .from(bitcoinUtxos)
      .where(
        and(
          eq(bitcoinUtxos.secretId, secretId),
          eq(bitcoinUtxos.status, "confirmed"),
        ),
      )
      .orderBy(desc(bitcoinUtxos.createdAt))

    if (!currentUtxo) {
      return json(
        { error: "No active Bitcoin UTXO found for this secret" },
        { status: 404 },
      )
    }

    // Mark old UTXO as spent
    await db
      .update(bitcoinUtxos)
      .set({
        status: "spent",
        spentAt: new Date(),
        spentByTxId: body.newTxId,
        updatedAt: new Date(),
      })
      .where(eq(bitcoinUtxos.id, currentUtxo.id))

    // Insert new UTXO record
    const [newUtxoRecord] = await db
      .insert(bitcoinUtxos)
      .values({
        secretId,
        txId: body.newTxId,
        outputIndex: body.newOutputIndex,
        amountSats: body.newAmountSats,
        timelockScript: body.newTimelockScript,
        ownerPubkey: currentUtxo.ownerPubkey,
        recipientPubkey: currentUtxo.recipientPubkey,
        ttlBlocks: body.ttlBlocks,
        status: "pending",
        preSignedRecipientTx: body.preSignedRecipientTx,
      })
      .returning()

    return json({
      utxoId: newUtxoRecord.id,
      newTxId: body.newTxId,
      newOutputIndex: body.newOutputIndex,
      newAmountSats: body.newAmountSats,
      ttlBlocks: body.ttlBlocks,
      previousUtxoId: currentUtxo.id,
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/store-bitcoin-refresh:", error)
    const message =
      error instanceof Error ? error.message : "Internal server error"
    return json({ error: message }, { status: 500 })
  }
}
