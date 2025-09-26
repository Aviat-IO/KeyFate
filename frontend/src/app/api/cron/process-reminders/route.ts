import { secretsService, connectionManager } from "@/lib/db/drizzle";
import { NextRequest, NextResponse } from "next/server";

function authorize(req: NextRequest): boolean {
  console.log("[process-reminders] Checking authorization...");

  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");
  console.log("[process-reminders] Authorization header present:", !!header);

  if (!header?.startsWith("Bearer ")) {
    console.log("[process-reminders] No Bearer token found");
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;

  console.log("[process-reminders] CRON_SECRET present:", !!cronSecret);
  console.log("[process-reminders] CRON_SECRET length:", cronSecret?.length || 0);
  console.log("[process-reminders] Token length:", token.length);

  const isValid = !!cronSecret && token === cronSecret;
  console.log("[process-reminders] Authorization valid:", isValid);

  return isValid;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[process-reminders] Starting database operation...");

    // Get connection stats for monitoring
    const stats = connectionManager.getStats();
    console.log("[process-reminders] Connection stats:", stats);

    // Check database health first
    const isHealthy = await secretsService.healthCheck();
    if (!isHealthy) {
      console.error("[process-reminders] Database health check failed");
      // Try to reconnect
      await connectionManager.closeConnection();
    }

    // Use the service method which handles async initialization
    const due = await secretsService.getOverdue();
    console.log(`[process-reminders] Found ${due.length} overdue secrets`);

    // For now, just report counts. Actual email sending logic can be added here or via services.
    return NextResponse.json({
      processed: due.length,
      stats: connectionManager.getStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[process-reminders] Error:", error);

    // Get connection stats for debugging
    const stats = connectionManager.getStats();
    console.error("[process-reminders] Connection stats on error:", stats);

    // Provide more detailed error information for debugging
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
      connectionStats: stats,
      timestamp: new Date().toISOString(),
    };

    console.error("[process-reminders] Detailed error:", errorDetails);

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
