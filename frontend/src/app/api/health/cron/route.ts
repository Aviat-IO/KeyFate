import { NextRequest, NextResponse } from "next/server"
import { cronMonitor } from "@/lib/monitoring/cron-monitor"
import { authorizeRequest } from "@/lib/cron/utils"

export const dynamic = "force-dynamic"

/**
 * Health check endpoint for cron job metrics
 *
 * Returns statistics for all monitored cron jobs including:
 * - Execution counts and success rates
 * - Duration percentiles (p95, p99)
 * - Last execution timestamps
 * - Recent execution history
 *
 * Authentication: Requires CRON_SECRET or valid HMAC signature
 */
export async function GET(req: NextRequest) {
  // Require authentication for internal metrics
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const stats = cronMonitor.getAllStats()

    // Calculate overall health
    const jobNames = Object.keys(stats)
    const healthyJobs = jobNames.filter((name) => {
      const jobStats = stats[name]
      const successRate =
        jobStats.totalExecutions > 0
          ? (jobStats.successCount / jobStats.totalExecutions) * 100
          : 100

      return successRate >= 80
    })

    const overallHealth =
      jobNames.length === 0
        ? "unknown"
        : healthyJobs.length === jobNames.length
          ? "healthy"
          : healthyJobs.length > jobNames.length / 2
            ? "degraded"
            : "unhealthy"

    return NextResponse.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      jobs: stats,
      summary: {
        totalJobs: jobNames.length,
        healthyJobs: healthyJobs.length,
        unhealthyJobs: jobNames.length - healthyJobs.length,
      },
    })
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
