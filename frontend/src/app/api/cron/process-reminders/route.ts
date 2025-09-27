import { secretsService, connectionManager } from "@/lib/db/drizzle";
import { NextRequest, NextResponse } from "next/server";

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;

  return !!cronSecret && token === cronSecret;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get connection stats for monitoring
    const stats = connectionManager.getStats();

    // Check database health first
    const isHealthy = await secretsService.healthCheck();
    if (!isHealthy) {
      // Try to reconnect
      await connectionManager.closeConnection();
    }

    // Use the service method which handles async initialization
    const due = await secretsService.getOverdue();

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

    // Provide error information
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      connectionStats: stats,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
