import { NextRequest, NextResponse } from "next/server"
import { getDatabaseStats } from "@/lib/db/get-database"
import { authorizeRequest } from "@/lib/cron/utils"

export const dynamic = "force-dynamic"

/**
 * Database connection pool health endpoint
 *
 * Returns connection pool statistics including:
 * - Active connections and queries
 * - Circuit breaker status
 * - Connection health metrics
 *
 * Authentication: Requires CRON_SECRET or valid HMAC signature
 */
export async function GET(req: NextRequest) {
  // Require authentication for internal metrics
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    return NextResponse.json(poolHealth, { status: statusCode })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
