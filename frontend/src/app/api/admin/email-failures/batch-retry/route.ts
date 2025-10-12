/**
 * Email Failure Batch Retry API
 *
 * POST /api/admin/email-failures/batch-retry - Retry multiple emails
 * Provides admin interface for batch retry operations
 */

import { NextRequest, NextResponse } from "next/server"
import { DeadLetterQueue } from "@/lib/email/dead-letter-queue"
import { db } from "@/lib/db/drizzle"
import { emailFailures } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendReminderEmail } from "@/lib/email/email-service"
import type { EmailFailureContext } from "@/lib/email/email-retry-service"

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
 * Request body for batch retry
 */
interface BatchRetryRequest {
  failureIds: string[]
}

/**
 * POST /api/admin/email-failures/batch-retry
 *
 * Retry multiple failed emails
 *
 * Request body:
 * {
 *   "failureIds": ["id1", "id2", "id3"]
 * }
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: BatchRetryRequest = await req.json()

    if (!body.failureIds || !Array.isArray(body.failureIds)) {
      return NextResponse.json(
        { error: "Invalid request - failureIds array required" },
        { status: 400 },
      )
    }

    if (body.failureIds.length === 0) {
      return NextResponse.json(
        { error: "No failure IDs provided" },
        { status: 400 },
      )
    }

    if (body.failureIds.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 failures can be retried at once" },
        { status: 400 },
      )
    }

    // Create retry operation factory
    const retryOperationFactory = async (failure: EmailFailureContext) => {
      // Only support reminder email retries for now
      if (failure.emailType === "reminder") {
        return await sendReminderEmail({
          userEmail: failure.recipient,
          userName: failure.recipient.split("@")[0],
          secretTitle: "Retry: Check-in Required",
          daysRemaining: 1,
          checkInUrl: "#",
          urgencyLevel: "high",
        })
      }

      // Other email types require more context
      return {
        success: false,
        error: `Cannot retry ${failure.emailType} email - manual intervention required`,
      }
    }

    const dlq = new DeadLetterQueue()
    const result = await dlq.batchRetry(body.failureIds, retryOperationFactory)

    return NextResponse.json({
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error) {
    console.error("[admin/email-failures/batch-retry] POST error:", error)

    return NextResponse.json(
      {
        error: "Failed to batch retry emails",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
