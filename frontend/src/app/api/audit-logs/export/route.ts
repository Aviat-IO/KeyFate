import { authConfig } from "@/lib/auth-config";
import { getDatabase } from "@/lib/db/drizzle";
import { auditLogs } from "@/lib/db/schema";
import { getUserTierInfo } from "@/lib/subscription";
import { and, desc, eq, gte, lte } from "drizzle-orm";
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
          error: "Audit log export is a Pro feature. Upgrade to access this functionality.",
          code: "TIER_LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const eventType = searchParams.get("event_type");
    const eventCategory = searchParams.get("event_category");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const db = await getDatabase();

    const conditions = [eq(auditLogs.userId, session.user.id)];

    if (eventType) {
      conditions.push(eq(auditLogs.eventType, eventType as any));
    }

    if (eventCategory) {
      conditions.push(eq(auditLogs.eventCategory, eventCategory as any));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10000);

    if (format === "json") {
      return NextResponse.json(logs, {
        headers: {
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString()}.json"`,
        },
      });
    }

    const csv = convertToCSV(logs);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function convertToCSV(logs: any[]): string {
  if (logs.length === 0) return "";

  const headers = [
    "id",
    "event_type",
    "event_category",
    "resource_type",
    "resource_id",
    "ip_address",
    "user_agent",
    "created_at",
    "details",
  ];

  const rows = logs.map((log) => {
    return headers
      .map((header) => {
        let value = log[header === "created_at" ? "createdAt" : header];
        if (header === "details" && value) {
          value = JSON.stringify(value);
        }
        if (value === null || value === undefined) {
          return "";
        }
        value = String(value).replace(/"/g, '""');
        return `"${value}"`;
      })
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
