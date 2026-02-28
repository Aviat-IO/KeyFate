import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getDatabaseStats } from "$lib/db/get-database"
import { authorizeRequest } from "$lib/cron/utils"

/**
 * GET /api/health/pool
 *
 * Database connection pool health endpoint.
 * Returns connection pool statistics.
 * Authentication: Requires CRON_SECRET or valid HMAC signature.
 */
export const GET: RequestHandler = async (event) => {
  // Require authentication for internal metrics
  if (!authorizeRequest(event.request as any)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = getDatabaseStats()

    const poolHealth = {
      status:
        stats.connected && !stats.circuitBreakerOpen ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      pool: {
        connected: stats.connected,
        activeQueries: stats.activeQueries,
        totalConnections: stats.totalConnections,
        totalErrors: stats.totalErrors,
        lastSuccessfulConnection:
          stats.lastSuccessfulConnection?.toISOString() || null,
        uptime: stats.uptime,
      },
      circuitBreaker: {
        open: stats.circuitBreakerOpen,
        resetTime: stats.circuitBreakerResetTime?.toISOString() || null,
      },
      shutdown: {
        isShuttingDown: stats.isShuttingDown,
      },
    }

    const statusCode = poolHealth.status === "healthy" ? 200 : 503

    return json(poolHealth, { status: statusCode })
  } catch (error) {
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
