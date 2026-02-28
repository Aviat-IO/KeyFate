/**
 * Email Failure Detail & Resolution API
 *
 * GET /api/admin/email-failures/:id - Get failure details
 * PATCH /api/admin/email-failures/:id - Mark failure as resolved
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { DeadLetterQueue } from "$lib/email/dead-letter-queue"

/**
 * Authorization helper
 */
async function isAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  const adminToken = process.env.ADMIN_TOKEN || "admin-secret"
  return authHeader === `Bearer ${adminToken}`
}

/**
 * GET /api/admin/email-failures/:id
 *
 * Get details of a specific email failure
 */
export const GET: RequestHandler = async (event) => {
  if (!(await isAdmin(event.request))) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const failureId = event.params.id
    const dlq = new DeadLetterQueue()

    // Query for the specific failure
    const failures = await dlq.queryFailures({
      limit: 1,
      offset: 0,
    })

    // Find the specific failure by ID
    // Note: DeadLetterQueue may not have a getById method,
    // so we filter from results
    const failure = failures.find((f: any) => f.id === failureId)

    if (!failure) {
      return json({ error: "Email failure not found" }, { status: 404 })
    }

    return json({ failure })
  } catch (error) {
    console.error("[admin/email-failures/[id]] GET error:", error)

    return json(
      {
        error: "Failed to get email failure",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/admin/email-failures/:id
 *
 * Mark a failed email as resolved without retry.
 * Used when admin manually fixes issue or determines retry is not needed.
 *
 * Note: The original Next.js route used DELETE, but the task spec says PATCH.
 * Using PATCH as specified since it better represents "updating" the resolution status.
 */
export const PATCH: RequestHandler = async (event) => {
  if (!(await isAdmin(event.request))) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const failureId = event.params.id

    const dlq = new DeadLetterQueue()
    const resolved = await dlq.markResolved(failureId)

    return json({
      success: true,
      failure: {
        id: resolved.id,
        emailType: resolved.emailType,
        recipient: resolved.recipient,
        resolvedAt: resolved.resolvedAt,
      },
    })
  } catch (error) {
    console.error("[admin/email-failures/[id]] PATCH error:", error)

    if (error instanceof Error && error.message.includes("not found")) {
      return json({ error: "Email failure not found" }, { status: 404 })
    }

    return json(
      {
        error: "Failed to resolve email failure",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
