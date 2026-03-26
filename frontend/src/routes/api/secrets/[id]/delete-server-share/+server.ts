import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { getDatabase } from "$lib/db/drizzle"
import { secrets } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"

export const DELETE: RequestHandler = async (event) => {
  try {
    const id = event.params.id

    const csrfCheck = await requireCSRFProtection(event)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    // Verify ownership and update in one go
    const result = await db
      .update(secrets)
      .set({
        serverShare: null,
        iv: null,
        authTag: null,
        status: "paused",
        updatedAt: new Date(),
      } as any)
      .where(and(eq(secrets.id, id), eq(secrets.userId, session.user.id)))
      .returning()
    if (result.length === 0) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    return json({ success: true })
  } catch (error) {
    console.error(
      "Error in DELETE /api/secrets/[id]/delete-server-share:",
      error,
    )
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
