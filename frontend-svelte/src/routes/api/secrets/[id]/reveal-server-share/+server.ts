import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import {
  requireRecentAuthentication,
  createReAuthErrorResponse,
} from "$lib/auth/re-authentication"
import { getDatabase } from "$lib/db/drizzle"
import { secrets } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// Validation schema for secret ID
const secretIdSchema = z.string().uuid({
  message: "Invalid secret ID format",
})

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

    const csrfCheck = await requireCSRFProtection(event)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const reAuthCheck = await requireRecentAuthentication(event.request as any)
    if (!reAuthCheck.valid) {
      return createReAuthErrorResponse(reAuthCheck.userId)
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
        { error: "No server share to reveal" },
        { status: 404 },
      )
    }

    return json({
      success: true,
      server_share: secret.serverShare,
      iv: secret.iv,
      auth_tag: secret.authTag,
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/reveal-server-share:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
