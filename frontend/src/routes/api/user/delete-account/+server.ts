import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import {
  initiateAccountDeletion,
  getActiveDeletionRequest,
} from "$lib/gdpr/deletion-service"
import { getDatabase } from "$lib/db/drizzle"
import { auditLogs } from "$lib/db/schema"

/**
 * DELETE /api/user/delete-account
 * Initiate account deletion request (requires OTP re-authentication)
 */
export const DELETE: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id

    const reauthToken = event.request.headers.get("x-reauth-token")

    if (!reauthToken) {
      return json(
        {
          error: "OTP re-authentication required",
          code: "REAUTH_REQUIRED",
        },
        { status: 403 },
      )
    }

    // Verify OTP re-authentication token against the user's email
    const userEmail = session.user.email
    if (!userEmail) {
      return json(
        { error: "Email not found for user account" },
        { status: 400 },
      )
    }

    const { validateOTPToken } = await import("$lib/auth/otp")
    const otpValidation = await validateOTPToken(userEmail, reauthToken)
    if (!otpValidation.success || !otpValidation.valid) {
      return json(
        {
          error: otpValidation.error || "Invalid or expired re-authentication token",
          code: "REAUTH_INVALID",
        },
        { status: 403 },
      )
    }

    // Check for existing active deletion request
    const existingRequest = await getActiveDeletionRequest(userId)
    if (existingRequest) {
      return json(
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

    return json({
      requestId: request.id,
      status: request.status,
      scheduledDeletionAt: request.scheduledDeletionAt,
      message: "Deletion request created. Please check your email to confirm.",
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in DELETE /api/user/delete-account:", error)
    return json(
      { error: "Failed to initiate account deletion" },
      { status: 500 },
    )
  }
}
