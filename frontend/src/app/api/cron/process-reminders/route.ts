import { db } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";
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
    const now = new Date();
    const due = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.status, "active"), lte(secrets.nextCheckIn, now)));

    // For now, just report counts. Actual email sending logic can be added here or via services.
    return NextResponse.json({ processed: due.length });
  } catch (error) {
    console.error("process-reminders error:", error);

    // Provide more detailed error information for debugging
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
      timestamp: new Date().toISOString(),
    };

    console.error("process-reminders detailed error:", errorDetails);

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
