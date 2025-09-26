import { connectionManager } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextRequest, NextResponse } from "next/server";

function authorize(req: NextRequest): boolean {
  console.log("[check-secrets] Checking authorization...");

  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");
  console.log("[check-secrets] Authorization header present:", !!header);

  if (!header?.startsWith("Bearer ")) {
    console.log("[check-secrets] No Bearer token found");
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;

  console.log("[check-secrets] CRON_SECRET present:", !!cronSecret);
  console.log("[check-secrets] CRON_SECRET length:", cronSecret?.length || 0);
  console.log("[check-secrets] Token length:", token.length);

  const isValid = !!cronSecret && token === cronSecret;
  console.log("[check-secrets] Authorization valid:", isValid);

  return isValid;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[check-secrets] Starting database operation...");

    // Get connection stats for monitoring
    const stats = connectionManager.getStats();
    console.log("[check-secrets] Connection stats:", stats);

    // Get database connection with retry logic
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const client = await connectionManager.getConnection(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 5,
    });

    const db = drizzle(client);

    const now = new Date();
    const toTrigger = await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          eq(secrets.isTriggered, false),
          lte(secrets.nextCheckIn, now),
          isNotNull(secrets.serverShare),
        ),
      );

    console.log(`[check-secrets] Found ${toTrigger.length} secrets to trigger`);

    // Placeholder: add email send + update status logic here
    const processed = toTrigger.length;
    return NextResponse.json({
      processed,
      stats: connectionManager.getStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[check-secrets] Error:", error);

    // Get connection stats for debugging
    const stats = connectionManager.getStats();
    console.error("[check-secrets] Connection stats on error:", stats);

    // Provide more detailed error information for debugging
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
      connectionStats: stats,
      timestamp: new Date().toISOString(),
    };

    console.error("[check-secrets] Detailed error:", errorDetails);

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
