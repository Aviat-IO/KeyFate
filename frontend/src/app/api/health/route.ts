import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db/connection";

export async function GET() {
  try {
    // Basic health check
    const dbConnected = await checkDatabaseConnection();

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbConnected ? "healthy" : "unhealthy",
        environment: process.env.NODE_ENV || "unknown",
        region: process.env.VERCEL_REGION || process.env.GOOGLE_CLOUD_REGION || "unknown",
      },
      version: {
        deploymentHash: process.env.DEPLOYMENT_HASH || "unknown",
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      },
    };

    const statusCode = dbConnected ? 200 : 503;
    if (!dbConnected) {
      health.status = "degraded";
    }

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}