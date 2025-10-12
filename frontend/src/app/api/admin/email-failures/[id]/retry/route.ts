/**
 * Email Failure Manual Retry API
 *
 * POST /api/admin/email-failures/:id/retry - Manually retry single email
 * Provides admin interface for manual retry of failed emails
 */

import { NextRequest, NextResponse } from "next/server"
import { DeadLetterQueue } from "@/lib/email/dead-letter-queue"
import { db } from "@/lib/db/drizzle"
import { emailFailures } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  sendReminderEmail,
  sendSecretDisclosureEmail,
} from "@/lib/email/email-service"

export const dynamic = "force-dynamic"

/**
 * Authorization helper
 */
async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization")
  const adminToken = process.env.ADMIN_TOKEN || "admin-secret"
  return authHeader === `Bearer ${adminToken}`
}

/**
 * POST /api/admin/email-failures/:id/retry
 *
 * Manually retry a failed email
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id: failureId } = await params

    // Fetch failure details
    const [failure] = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.id, failureId))
      .limit(1)

    if (!failure) {
      return NextResponse.json(
        { error: "Email failure not found" },
        { status: 404 },
      )
    }

    // Create retry operation based on email type
    const retryOperation = async () => {
      // Parse original email data from subject/recipient
      // Note: In production, you'd want to store full email context
      // For now, we'll create a basic retry based on available data

      switch (failure.emailType) {
        case "reminder":
          return await sendReminderEmail({
            userEmail: failure.recipient,
            userName: failure.recipient.split("@")[0],
            secretTitle: "Retry: Check-in Required",
            daysRemaining: 1,
            checkInUrl: "#", // Placeholder - would need original URL
            urgencyLevel: "high",
          })

        case "disclosure":
          // Note: Can't retry disclosure without original secret content
          // This would need to be stored or reconstructed
          return {
            success: false,
            error:
              "Cannot retry disclosure email - original content not available",
          }

        case "admin_notification":
          return {
            success: false,
            error: "Cannot retry admin notification - use manual send",
          }

        case "verification":
          return {
            success: false,
            error: "Cannot retry verification email - generate new token",
          }

        default:
          return {
            success: false,
            error: `Unknown email type: ${failure.emailType}`,
          }
      }
    }

    const dlq = new DeadLetterQueue()
    const result = await dlq.manualRetry(failureId, retryOperation)

    return NextResponse.json({
      success: result.success,
      error: result.error,
      exhausted: result.exhausted,
      permanent: result.permanent,
      nextRetryAt: result.nextRetryAt,
    })
  } catch (error) {
    console.error("[admin/email-failures/retry] POST error:", error)

    return NextResponse.json(
      {
        error: "Failed to retry email",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
