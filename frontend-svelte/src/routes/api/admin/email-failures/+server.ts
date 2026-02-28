/**
 * Email Failures Admin API
 *
 * GET /api/admin/email-failures - List failed emails with filtering
 * Provides admin interface for viewing and managing email failures
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { DeadLetterQueue } from "$lib/email/dead-letter-queue"
import {
  getClientIp,
  getAdminWhitelist,
  isIpWhitelisted,
} from "$lib/auth/ip-whitelist"
import { logger } from "$lib/logger"

/**
 * Authorization helper - verify admin access
 */
async function isAdmin(request: Request): Promise<boolean> {
  const adminToken = process.env.ADMIN_TOKEN

  if (!adminToken) {
    throw new Error(
      "ADMIN_TOKEN environment variable is not configured. Server cannot start without admin authentication.",
    )
  }

  const clientIp = getClientIp(request)
  const whitelist = getAdminWhitelist()

  if (!isIpWhitelisted(clientIp, whitelist)) {
    logger.warn("Admin access denied - IP not whitelisted", { clientIp })
    return false
  }

  const authHeader = request.headers.get("authorization")
  const isAuthenticated = authHeader === `Bearer ${adminToken}`

  if (!isAuthenticated) {
    logger.warn("Admin access denied - invalid token", { clientIp })
  }

  return isAuthenticated
}

/**
 * GET /api/admin/email-failures
 *
 * Query failed emails with optional filters
 *
 * Query params:
 * - emailType: reminder | disclosure | admin_notification | verification
 * - provider: sendgrid | console-dev | resend
 * - recipient: email address
 * - unresolvedOnly: true | false
 * - limit: number (default 100)
 * - offset: number (default 0)
 * - stats: true | false (return stats instead of failures)
 */
export const GET: RequestHandler = async (event) => {
  // Verify admin access
  if (!(await isAdmin(event.request))) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = event.url

    // Check if stats requested
    if (searchParams.get("stats") === "true") {
      const dlq = new DeadLetterQueue()
      const stats = await dlq.getStats()
      return json(stats)
    }

    // Parse query parameters
    const emailType = searchParams.get("emailType") as any
    const provider = searchParams.get("provider") as any
    const recipient = searchParams.get("recipient") || undefined
    const unresolvedOnly = searchParams.get("unresolvedOnly") === "true"
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    const dlq = new DeadLetterQueue()
    const failures = await dlq.queryFailures({
      emailType,
      provider,
      recipient,
      unresolvedOnly,
      limit,
      offset,
    })

    return json({
      failures,
      count: failures.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error("[admin/email-failures] GET error:", error)

    return json(
      {
        error: "Failed to query email failures",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
