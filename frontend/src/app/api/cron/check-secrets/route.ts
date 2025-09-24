import { db } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";
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
