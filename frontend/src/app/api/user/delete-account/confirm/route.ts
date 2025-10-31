import { NextResponse } from "next/server"
import { confirmAccountDeletion } from "@/lib/gdpr/deletion-service"
import { getDatabase } from "@/lib/db/get-database"
import { auditLogs } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

/**
 * POST /api/user/delete-account/confirm
 * Confirm account deletion request via email token
 */
export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Confirmation token required" },
        { status: 400 },
      )
    }

    // Confirm deletion
    const deletionRequest = await confirmAccountDeletion(token)

    // Log audit event
    const db = await getDatabase()
    await db.insert(auditLogs).values({
      userId: deletionRequest.userId,
      eventType: "account_deletion_confirmed",
      eventCategory: "settings",
      details: {
        requestId: deletionRequest.id,
        scheduledDeletionAt: deletionRequest.scheduledDeletionAt,
      },
    })

    return NextResponse.json({
      success: true,
      status: deletionRequest.status,
      scheduledDeletionAt: deletionRequest.scheduledDeletionAt,
      message:
        "Account deletion confirmed. Your account will be deleted after the 30-day grace period.",
    })
  } catch (error: any) {
    console.error("Error in POST /api/user/delete-account/confirm:", error)
    return NextResponse.json(
      { error: error.message || "Failed to confirm deletion" },
      { status: 400 },
    )
  }
}
