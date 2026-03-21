import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { checkDatabaseConnection } from "$lib/db/connection"
import { getDatabaseStats } from "$lib/db/drizzle"
import { logger } from "$lib/logger"
import { getEmailServiceHealth } from "$lib/email/email-service"
import { authorizeRequest } from "$lib/cron/utils"

/**
 * Check that the email service is configured (API key present).
 * Does NOT call the SendGrid API — external service checks should not
 * run on every health probe as they slow down probes and can cause
 * false negatives when the external service is temporarily unreachable.
 */
function checkEmailConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY
}

function checkEncryptionKey(): boolean {
  try {
    const key = process.env.ENCRYPTION_KEY
    if (!key) return false

    const decoded = Buffer.from(key, "base64")
    return decoded.length === 32
  } catch {
    return false
  }
}

/**
 * GET /api/health
 *
 * Health check endpoint. Verifies server is running and database is reachable.
 * Does NOT call external services (SendGrid, Stripe, BTCPay) — those checks
 * slow down probes and cause false negatives.
 * Detailed metrics require CRON_SECRET authorization.
 */
export const GET: RequestHandler = async (event) => {
  const detailed = event.url.searchParams.get("detailed") === "true"

  // Require authentication for detailed metrics (contains internal config)
  if (detailed && !authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Core checks: server running + database reachable + config present.
    // External service calls (SendGrid, Stripe, BTCPay) are intentionally
    // excluded — they slow down probes and cause false negatives when the
    // external service is temporarily unreachable.
    const dbConnected = await checkDatabaseConnection()
    const emailConfigured = checkEmailConfigured()
    const encryptionKeyValid = checkEncryptionKey()

    const checks = {
      database: dbConnected ? "healthy" : "unhealthy",
      email: emailConfigured ? "configured" : "unconfigured",
      encryption: encryptionKeyValid ? "healthy" : "unhealthy",
    }

    // Core services required for basic operation
    const healthy = dbConnected && emailConfigured && encryptionKeyValid

    const dbStats = getDatabaseStats()
    const emailCircuitStats = getEmailServiceHealth()

    const health = {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      ...(detailed && {
        environment: process.env.NODE_ENV || "unknown",
        region: process.env.RAILWAY_REGION || "unknown",
        version: {
          deploymentHash: process.env.RAILWAY_DEPLOYMENT_ID || process.env.DEPLOYMENT_HASH || "unknown",
          gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA || "unknown",
        },
        database: {
          connected: dbStats.connected,
          activeQueries: dbStats.activeQueries,
          totalConnections: dbStats.totalConnections,
          totalErrors: dbStats.totalErrors,
          circuitBreakerOpen: dbStats.circuitBreakerOpen,
          isShuttingDown: dbStats.isShuttingDown,
        },
        email: {
          circuitBreaker: emailCircuitStats,
        },
      }),
    }

    const statusCode = healthy ? 200 : 503

    return json(health, { status: statusCode })
  } catch (error) {
    logger.error("Health check failed", error as Error)

    return json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        // Error details intentionally omitted from client response (logged above)
      },
      { status: 500 },
    )
  }
}
