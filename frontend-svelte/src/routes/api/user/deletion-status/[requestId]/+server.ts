import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { getDatabase } from "$lib/db/get-database"
import { accountDeletionRequests } from "$lib/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * GET /api/user/deletion-status/[requestId]
 * Get deletion request status
 */
export const GET: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id
    const { requestId } = event.params

    const db = await getDatabase()

    // Get deletion request
    const [deletionRequest] = await db
      .select()
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.id, requestId),
          eq(accountDeletionRequests.userId, userId),
        ),
      )

    if (!deletionRequest) {
      return json(
        { error: "Deletion request not found" },
        { status: 404 },
      )
    }

    return json({
      id: deletionRequest.id,
      status: deletionRequest.status,
      scheduledDeletionAt: deletionRequest.scheduledDeletionAt,
      confirmedAt: deletionRequest.confirmedAt,
      cancelledAt: deletionRequest.cancelledAt,
      deletedAt: deletionRequest.deletedAt,
      createdAt: deletionRequest.createdAt,
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in GET /api/user/deletion-status/[requestId]:", error)
    return json(
      { error: "Failed to retrieve deletion status" },
      { status: 500 },
    )
  }
}
