import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { cancelAccountDeletion } from "@/lib/gdpr/deletion-service"
import { getDatabase } from "@/lib/db/get-database"
import { auditLogs } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

/**
 * POST /api/user/delete-account/cancel/[requestId]
 * Cancel account deletion request
 */
export async function POST(
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

    return NextResponse.json({
      success: true,
      message: "Account deletion cancelled successfully",
    })
  } catch (error: any) {
    console.error(
      "Error in POST /api/user/delete-account/cancel/[requestId]:",
      error,
    )
    return NextResponse.json(
      { error: error.message || "Failed to cancel deletion" },
      { status: 400 },
    )
  }
}
