/**
 * POST /api/secrets/[id]/publish-nostr
 *
 * Publishes encrypted Shamir shares to Nostr relays via NIP-59 gift wraps.
 * The client sends shares (which it generated client-side) along with
 * recipient IDs. The server uses its Nostr keypair to double-encrypt
 * and gift-wrap each share for the corresponding recipient's nostr pubkey.
 *
 * Request body:
 * {
 *   shares: Array<{ share: string, shareIndex: number, recipientId: string }>
 *   threshold: number
 *   totalShares: number
 * }
 *
 * Response:
 * {
 *   published: Array<{ recipientId: string, nostrEventId: string, plaintextK: string }>
 *   skipped: string[]
 *   errors: Array<{ recipientId: string, error: string }>
 * }
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { getDatabase } from "$lib/db/drizzle"
import { secrets, secretRecipients } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { hex } from "@scure/base"
import { generateSecretKey } from "nostr-tools/pure"
import { publishSharesToNostr } from "$lib/services/nostr-publisher"
import type { RecipientInfo } from "$lib/services/nostr-publisher"

/** Get or generate the server's Nostr secret key. */
function getServerNostrSecretKey(): Uint8Array {
  const envKey = process.env.NOSTR_SERVER_SECRET_KEY
  if (envKey) {
    const bytes = hex.decode(envKey)
    if (bytes.length !== 32) {
      throw new Error(
        "NOSTR_SERVER_SECRET_KEY must be a 64-character hex string (32 bytes)",
      )
    }
    return bytes
  }

  // Generate an ephemeral key if no env var is set.
  // In production, NOSTR_SERVER_SECRET_KEY should always be configured
  // so the server identity is stable across restarts.
  return generateSecretKey()
}

const publishNostrSchema = z.object({
  shares: z
    .array(
      z.object({
        share: z.string().min(1, "Share data is required"),
        shareIndex: z.number().int().min(0, "Share index must be non-negative"),
        recipientId: z.string().uuid("Invalid recipient ID"),
      }),
    )
    .min(1, "At least one share is required")
    .max(10, "Maximum 10 shares per request"),
  threshold: z.number().int().min(2).max(7),
  totalShares: z.number().int().min(3).max(7),
})

export const POST: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const secretId = event.params.id

    const body = await event.request.json()
    const parsed = publishNostrSchema.safeParse(body)

    if (!parsed.success) {
      return json(
        {
          error: "Invalid request data",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      )
    }

    const { shares, threshold, totalShares } = parsed.data

    const db = await getDatabase()

    // Verify the secret exists and belongs to the user
    const [secret] = await db
      .select({ id: secrets.id })
      .from(secrets)
      .where(and(eq(secrets.id, secretId), eq(secrets.userId, session.user.id)))

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    // Fetch recipients for this secret
    const recipients = await db
      .select({
        id: secretRecipients.id,
        nostrPubkey: secretRecipients.nostrPubkey,
      })
      .from(secretRecipients)
      .where(eq(secretRecipients.secretId, secretId))

    // Validate that all share recipientIds belong to this secret
    const recipientIds = new Set(recipients.map((r) => r.id))
    for (const share of shares) {
      if (!recipientIds.has(share.recipientId)) {
        return json(
          {
            error: `Recipient ${share.recipientId} does not belong to this secret`,
          },
          { status: 400 },
        )
      }
    }

    const senderSecretKey = getServerNostrSecretKey()

    const recipientInfos: RecipientInfo[] = recipients.map((r) => ({
      id: r.id,
      nostrPubkey: r.nostrPubkey,
    }))

    const result = await publishSharesToNostr({
      secretId,
      shares,
      recipients: recipientInfos,
      senderSecretKey,
      threshold,
      totalShares,
    })

    // Convert Uint8Array plaintextK values to hex strings for JSON serialization
    const published = result.published.map((p) => ({
      recipientId: p.recipientId,
      nostrEventId: p.nostrEventId,
      plaintextK: hex.encode(p.plaintextK),
    }))

    return json(
      {
        published,
        skipped: result.skipped,
        errors: result.errors,
      },
      { status: published.length > 0 ? 200 : 422 },
    )
  } catch (err) {
    // SvelteKit HttpError (from requireSession) - re-throw
    if (err && typeof err === "object" && "status" in err) {
      throw err
    }

    console.error("Error in POST /api/secrets/[id]/publish-nostr:", err)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
