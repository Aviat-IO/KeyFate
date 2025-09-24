import { db } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";
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

    // Placeholder: add email send + update status logic here
    const processed = toTrigger.length;
    return NextResponse.json({ processed });
  } catch (error) {
    console.error("check-secrets error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, {
      status: 500,
    });
  }
}
