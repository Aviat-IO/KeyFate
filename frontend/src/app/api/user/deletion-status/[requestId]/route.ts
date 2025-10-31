import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db/get-database"
import { accountDeletionRequests } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * GET /api/user/deletion-status/[requestId]
 * Get deletion request status
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const params = await context.params
  try {
    const session = (await getServerSession(
      authConfig,
    )) as Session | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { requestId } = params

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
      return NextResponse.json(
        { error: "Deletion request not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({
      id: deletionRequest.id,
      status: deletionRequest.status,
      scheduledDeletionAt: deletionRequest.scheduledDeletionAt,
      confirmedAt: deletionRequest.confirmedAt,
      cancelledAt: deletionRequest.cancelledAt,
      deletedAt: deletionRequest.deletedAt,
      createdAt: deletionRequest.createdAt,
    })
  } catch (error) {
    console.error("Error in GET /api/user/deletion-status/[requestId]:", error)
    return NextResponse.json(
      { error: "Failed to retrieve deletion status" },
      { status: 500 },
    )
  }
}
