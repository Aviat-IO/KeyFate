import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { cancelAccountDeletion } from "$lib/gdpr/deletion-service"
import { getDatabase } from "$lib/db/get-database"
import { auditLogs } from "$lib/db/schema"

/**
 * POST /api/user/delete-account/cancel/[requestId]
 * Cancel account deletion request
 */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id
    const { requestId } = event.params

    // Cancel deletion
    await cancelAccountDeletion(requestId, userId)

    // Log audit event
    const db = await getDatabase()
    await db.insert(auditLogs).values({
      userId,
      eventType: "account_deletion_cancelled",
      eventCategory: "settings",
      details: {
        requestId,
      },
    })

    return json({
      success: true,
      message: "Account deletion cancelled successfully",
    })
  } catch (error: any) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error(
      "Error in POST /api/user/delete-account/cancel/[requestId]:",
      error,
    )
    return json(
      { error: error.message || "Failed to cancel deletion" },
      { status: 400 },
    )
  }
}
