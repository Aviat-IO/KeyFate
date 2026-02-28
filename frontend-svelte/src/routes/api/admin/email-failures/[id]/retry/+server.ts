/**
 * Email Failure Manual Retry API
 *
 * POST /api/admin/email-failures/:id/retry - Manually retry single email
 * Provides admin interface for manual retry of failed emails
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { DeadLetterQueue } from "$lib/email/dead-letter-queue"
import { getDatabase } from "$lib/db/drizzle"
import { emailFailures } from "$lib/db/schema"
import { eq } from "drizzle-orm"
import { sendReminderEmail } from "$lib/email/email-service"

/**
 * Authorization helper
 */
async function isAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  const adminToken = process.env.ADMIN_TOKEN || "admin-secret"
  return authHeader === `Bearer ${adminToken}`
}

/**
 * POST /api/admin/email-failures/:id/retry
 *
 * Manually retry a failed email
 */
export const POST: RequestHandler = async (event) => {
  if (!(await isAdmin(event.request))) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const failureId = event.params.id
    const db = await getDatabase()

    // Fetch failure details
    const [failure] = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.id, failureId))
      .limit(1)

    if (!failure) {
      return json({ error: "Email failure not found" }, { status: 404 })
    }

    // Create retry operation based on email type
    const retryOperation = async () => {
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

    return json({
      success: result.success,
      error: result.error,
      exhausted: result.exhausted,
      permanent: result.permanent,
      nextRetryAt: result.nextRetryAt,
    })
  } catch (error) {
    console.error("[admin/email-failures/retry] POST error:", error)

    return json(
      {
        error: "Failed to retry email",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
