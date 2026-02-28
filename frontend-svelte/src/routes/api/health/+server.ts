import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { checkDatabaseConnection } from "$lib/db/connection"
import { getDatabaseStats } from "$lib/db/get-database"
import { logger } from "$lib/logger"
import { getEmailServiceHealth } from "$lib/email/email-service"
import { authorizeRequest } from "$lib/cron/utils"

async function checkEmailService(): Promise<boolean> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return false

    const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    return response.ok
  } catch (error) {
    logger.warn("Email service health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function checkStripeService(): Promise<boolean> {
  try {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) return false

    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    return response.ok
  } catch (error) {
    logger.warn("Stripe service health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function checkBTCPayService(): Promise<boolean> {
  try {
    const serverUrl = process.env.BTCPAY_SERVER_URL
    const apiKey = process.env.BTCPAY_API_KEY

    if (!serverUrl || !apiKey) return false

    const response = await fetch(`${serverUrl}/api/v1/server/info`, {
      headers: {
        Authorization: `token ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    return response.ok
  } catch (error) {
    logger.warn("BTCPay service health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
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
 * Comprehensive health check endpoint.
 * Detailed metrics require CRON_SECRET authorization.
 */
export const GET: RequestHandler = async (event) => {
  const detailed = event.url.searchParams.get("detailed") === "true"

  // Require authentication for detailed metrics (contains internal config)
  if (detailed && !authorizeRequest(event.request as any)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check core services in parallel
    const [dbConnected, emailHealthy, stripeHealthy, btcpayHealthy] =
      await Promise.all([
        checkDatabaseConnection(),
        checkEmailService(),
        detailed ? checkStripeService() : Promise.resolve(true),
        detailed ? checkBTCPayService() : Promise.resolve(true),
      ])

    const encryptionKeyValid = checkEncryptionKey()

    const checks = {
      database: dbConnected ? "healthy" : "unhealthy",
      email: emailHealthy ? "healthy" : "unhealthy",
      encryption: encryptionKeyValid ? "healthy" : "unhealthy",
      ...(detailed && {
        stripe: stripeHealthy ? "healthy" : "unhealthy",
        btcpay: btcpayHealthy ? "healthy" : "unhealthy",
      }),
    }

    // Core services required for basic operation
    const coreHealthy = dbConnected && emailHealthy && encryptionKeyValid

    // Payment services are optional - don't fail health check if unavailable
    const allHealthy = detailed
      ? coreHealthy && stripeHealthy && btcpayHealthy
      : coreHealthy

    const anyUnhealthy = !coreHealthy

    const dbStats = getDatabaseStats()
    const emailCircuitStats = getEmailServiceHealth()

    const health = {
      status: allHealthy ? "healthy" : anyUnhealthy ? "degraded" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
      ...(detailed && {
        environment: process.env.NODE_ENV || "unknown",
        region:
          process.env.VERCEL_REGION ||
          process.env.GOOGLE_CLOUD_REGION ||
          "unknown",
        version: {
          deploymentHash: process.env.DEPLOYMENT_HASH || "unknown",
          gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
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

    const statusCode = allHealthy ? 200 : anyUnhealthy ? 503 : 500

    return json(health, { status: statusCode })
  } catch (error) {
    logger.error("Health check failed", error as Error)

    return json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
