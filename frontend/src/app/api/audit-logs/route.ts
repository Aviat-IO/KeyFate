import { authConfig } from "@/lib/auth-config";
import { getDatabase } from "@/lib/db/drizzle";
import { auditLogs } from "@/lib/db/schema";
import { getUserTierInfo } from "@/lib/subscription";
import { and, desc, eq, gte, lte, like, or } from "drizzle-orm";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(
      authConfig as Parameters<typeof getServerSession>[0],
    )) as Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tierInfo = await getUserTierInfo(session.user.id);
    const userTier = (tierInfo?.tier?.tiers?.name ?? "free") as "free" | "pro";

    if (userTier !== "pro") {
      return NextResponse.json(
        {
          error: "Audit logs are a Pro feature. Upgrade to access comprehensive audit trails.",
          code: "TIER_LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const eventType = searchParams.get("event_type");
    const eventCategory = searchParams.get("event_category");
    const resourceId = searchParams.get("resource_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    const db = await getDatabase();

    const conditions = [eq(auditLogs.userId, session.user.id)];

    if (eventType) {
      conditions.push(eq(auditLogs.eventType, eventType as any));
    }

    if (eventCategory) {
      conditions.push(eq(auditLogs.eventCategory, eventCategory as any));
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (search) {
      conditions.push(
        or(
          like(auditLogs.eventType, `%${search}%`),
          like(auditLogs.resourceType, `%${search}%`),
        )!,
      );
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: auditLogs.id })
      .from(auditLogs)
      .where(and(...conditions));

    const total = logs.length;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
