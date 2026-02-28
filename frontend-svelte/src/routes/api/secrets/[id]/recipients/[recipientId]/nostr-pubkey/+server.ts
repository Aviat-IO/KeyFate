/**
 * API endpoint for managing a recipient's Nostr public key.
 *
 * PUT  - Set or update the recipient's npub
 * DELETE - Remove the recipient's npub
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { getDatabase } from "$lib/db/drizzle"
import { secrets, secretRecipients } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { isValidNpub, npubToHex } from "$lib/nostr/keypair"

const putSchema = z.object({
  npub: z.string().refine(isValidNpub, {
    message: "Invalid npub format. Must be a valid Nostr public key (npub1…).",
  }),
})

/**
 * Verify the authenticated user owns the secret that contains the recipient.
 * Returns the recipient row or null.
 */
async function getOwnedRecipient(
  userId: string,
  secretId: string,
  recipientId: string,
) {
  const db = await getDatabase()

  // Verify the secret belongs to the user
  const [secret] = await db
    .select({ id: secrets.id })
    .from(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)))

  if (!secret) return null

  // Verify the recipient belongs to that secret
  const [recipient] = await db
    .select()
    .from(secretRecipients)
    .where(
      and(
        eq(secretRecipients.id, recipientId),
        eq(secretRecipients.secretId, secretId),
      ),
    )

  return recipient ?? null
}

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const { id: secretId, recipientId } = event.params

    const body = await event.request.json()
    const parsed = putSchema.safeParse(body)

    if (!parsed.success) {
      return json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      )
    }

    const recipient = await getOwnedRecipient(
      session.user.id,
      secretId,
      recipientId,
    )

    if (!recipient) {
      return json({ error: "Recipient not found" }, { status: 404 })
    }

    // Convert npub to hex for storage validation, but store the npub
    const hexPubkey = npubToHex(parsed.data.npub)

    const db = await getDatabase()
    const [updated] = await db
      .update(secretRecipients)
      .set({
        nostrPubkey: hexPubkey,
        updatedAt: new Date(),
      })
      .where(eq(secretRecipients.id, recipientId))
      .returning()

    return json({
      id: updated.id,
      nostrPubkey: updated.nostrPubkey,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return json(
        { error: "Invalid data", details: err.issues },
        { status: 400 },
      )
    }

    // SvelteKit HttpError (from requireSession) – re-throw so SvelteKit handles it
    if (err && typeof err === "object" && "status" in err) {
      throw err
    }

    console.error("Error setting Nostr pubkey:", err)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

export const DELETE: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const { id: secretId, recipientId } = event.params

    const recipient = await getOwnedRecipient(
      session.user.id,
      secretId,
      recipientId,
    )

    if (!recipient) {
      return json({ error: "Recipient not found" }, { status: 404 })
    }

    const db = await getDatabase()
    await db
      .update(secretRecipients)
      .set({
        nostrPubkey: null,
        updatedAt: new Date(),
      })
      .where(eq(secretRecipients.id, recipientId))

    return json({ success: true })
  } catch (err) {
    // SvelteKit HttpError – re-throw
    if (err && typeof err === "object" && "status" in err) {
      throw err
    }

    console.error("Error removing Nostr pubkey:", err)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
