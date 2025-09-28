import { NextResponse } from "next/server";
import { checkDatabaseConnectionHealth } from "@/lib/db/connection";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const healthCheck = await checkDatabaseConnectionHealth();

    if (healthCheck.isHealthy) {
      return NextResponse.json({
        status: "healthy",
        database: {
          connected: true,
          responseTime: `${healthCheck.responseTime}ms`,
          poolStats: healthCheck.poolStats,
        },
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    } else {
      return NextResponse.json({
        status: "unhealthy",
        database: {
          connected: false,
          error: healthCheck.error,
          responseTime: `${healthCheck.responseTime}ms`,
          poolStats: healthCheck.poolStats,
        },
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json({
      status: "error",
      database: {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}