import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import {
  initiateAccountDeletion,
  getActiveDeletionRequest,
} from "@/lib/gdpr/deletion-service"
import { getDatabase } from "@/lib/db/get-database"
import { auditLogs } from "@/lib/db/schema"
import { headers } from "next/headers"

export const dynamic = "force-dynamic"

/**
 * DELETE /api/user/delete-account
 * Initiate account deletion request (requires OTP re-authentication)
 */
export async function DELETE() {
  try {
    const session = (await getServerSession(
      authConfig,
    )) as Session | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Check for OTP re-authentication token
    const headersList = await headers()
    const reauthToken = headersList.get("x-reauth-token")

    if (!reauthToken) {
      return NextResponse.json(
        {
          error: "OTP re-authentication required",
          code: "REAUTH_REQUIRED",
        },
        { status: 403 },
      )
    }

    // TODO: Verify OTP re-authentication token
    // For now, we'll validate that it exists
    // In production, this should verify against a recent OTP validation

    // Check for existing active deletion request
    const existingRequest = await getActiveDeletionRequest(userId)
    if (existingRequest) {
      return NextResponse.json(
        {
          error: "You already have an active deletion request",
          code: "ALREADY_PENDING",
          requestId: existingRequest.id,
        },
        { status: 409 },
      )
    }

    // Initiate deletion request
    const request = await initiateAccountDeletion(userId)

    // Log audit event
    const db = await getDatabase()
    await db.insert(auditLogs).values({
      userId,
      eventType: "account_deletion_requested",
      eventCategory: "settings",
      details: {
        requestId: request.id,
        scheduledDeletionAt: request.scheduledDeletionAt,
      },
    })

    return NextResponse.json({
      requestId: request.id,
      status: request.status,
      scheduledDeletionAt: request.scheduledDeletionAt,
      message: "Deletion request created. Please check your email to confirm.",
    })
  } catch (error) {
    console.error("Error in DELETE /api/user/delete-account:", error)
    return NextResponse.json(
      { error: "Failed to initiate account deletion" },
      { status: 500 },
    )
  }
}
