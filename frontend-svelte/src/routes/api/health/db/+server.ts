import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { checkDatabaseConnectionHealth } from "$lib/db/connection"

/**
 * GET /api/health/db
 *
 * Simple database connection health check.
 */
export const GET: RequestHandler = async () => {
  try {
    const healthCheck = await checkDatabaseConnectionHealth()

    if (healthCheck.isHealthy) {
      return json(
        {
          status: "healthy",
          database: {
            connected: true,
            responseTime: `${healthCheck.responseTime}ms`,
            poolStats: healthCheck.poolStats,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      )
    } else {
      return json(
        {
          status: "unhealthy",
          database: {
            connected: false,
            error: healthCheck.error,
            responseTime: `${healthCheck.responseTime}ms`,
            poolStats: healthCheck.poolStats,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      )
    }
  } catch (error) {
    console.error("Database health check failed:", error)

    return json(
      {
        status: "error",
        database: {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
