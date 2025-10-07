/**
 * Database Health Check API Endpoint
 *
 * Provides database connection health status and monitoring information
 * for Cloud SQL PostgreSQL database.
 *
 * GET /api/health/database
 *
 * Returns:
 * - 200: Database is healthy
 * - 503: Database is unavailable
 * - 500: Health check error
 */

import { connectionManager } from "@/lib/db/connection-manager";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthCheckResponse {
  status: "healthy" | "unhealthy" | "error";
  timestamp: string;
  database: {
    connected: boolean;
    lastSuccessfulConnection: string | null;
    connectionAttempts: number;
    circuitBreakerOpen: boolean;
    circuitBreakerResetTime: string | null;
  };
  health?: {
    querySuccessful: boolean;
    responseTime: number;
  };
  error?: string;
}

export async function GET() {
  try {
    const stats = connectionManager.getStats();
    const startTime = Date.now();

    // Perform health check
    const isHealthy = await connectionManager.healthCheck();
    const responseTime = Date.now() - startTime;

    const response: HealthCheckResponse = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: stats.connected,
        lastSuccessfulConnection: stats.lastSuccessfulConnection?.toISOString() || null,
        connectionAttempts: stats.connectionAttempts,
        circuitBreakerOpen: stats.circuitBreakerOpen,
        circuitBreakerResetTime: stats.circuitBreakerResetTime?.toISOString() || null,
      },
      health: isHealthy
        ? {
            querySuccessful: true,
            responseTime,
          }
        : undefined,
    };

    if (!isHealthy) {
      return NextResponse.json(response, { status: 503 });
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    const errorResponse: HealthCheckResponse = {
      status: "error",
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        lastSuccessfulConnection: null,
        connectionAttempts: 0,
        circuitBreakerOpen: false,
        circuitBreakerResetTime: null,
      },
      error: error?.message || "Health check failed",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
