import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { getDatabase } from "$lib/db/drizzle"
import { secrets } from "$lib/db/schema"
import { decryptMessage } from "$lib/encryption"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// Validation schema for secret ID
const secretIdSchema = z.string().uuid({
  message: "Invalid secret ID format",
})

/**
 * Export Share API
 *
 * Returns the DECRYPTED server share for inclusion in a recovery kit.
 * Requires CSRF protection for security.
 *
 * This is different from reveal-server-share which returns encrypted data.
 * The decryption happens server-side since the encryption key is not available client-side.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const id = event.params.id

    // Validate UUID format before any processing
    const validation = secretIdSchema.safeParse(id)
    if (!validation.success) {
      return json(
        {
          error: "Invalid secret ID format",
          details: validation.error.flatten().formErrors,
        },
        { status: 400 },
      )
    }

    const csrfCheck = await requireCSRFProtection(event.request as any)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    const result = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.userId, session.user.id)))
      .limit(1)
    const secret = result[0]

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    if (!secret.serverShare) {
      return json(
        { error: "No server share to export" },
        { status: 404 },
      )
    }

    // Decrypt the server share
    const decryptedShare = await decryptMessage(
      secret.serverShare,
      Buffer.from(secret.iv!, "base64"),
      Buffer.from(secret.authTag!, "base64"),
      secret.keyVersion ?? undefined,
    )

    return json({
      success: true,
      serverShare: decryptedShare,
      metadata: {
        id: secret.id,
        title: secret.title,
        checkInDays: secret.checkInDays,
        createdAt: secret.createdAt?.toISOString(),
        threshold: secret.sssThreshold,
        totalShares: secret.sssSharesTotal,
      },
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/export-share:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
