import { getDatabase } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
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
    // Get database connection using standard utility
    const db = await getDatabase();

    // Get overdue secrets
    const now = new Date();
    const due = await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          lt(secrets.nextCheckIn, now),
        ),
      );

    // For now, just report counts. Actual email sending logic can be added here or via services.
    return NextResponse.json({
      processed: due.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[process-reminders] Error:", error);

    // Provide error information
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
