import { db } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
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
    return NextResponse.json({ error: "Internal Server Error" }, {
      status: 500,
    });
  }
}
