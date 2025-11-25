import { authConfig } from "@/lib/auth-config"
import { getDatabase } from "@/lib/db/drizzle"
import { auditLogs } from "@/lib/db/schema"
import { getUserTierInfo } from "@/lib/subscription"
import { and, desc, eq, gte, lte, like, or, count } from "drizzle-orm"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { APIError, handleAPIError } from "@/lib/errors/api-error"
import {
  parseOffsetPagination,
  buildOffsetPaginatedResponse,
} from "@/lib/api/pagination"
import { sanitizeString } from "@/lib/api/validation"
import { z } from "zod"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authConfig)) as Session | null

    if (!session?.user?.id) {
      throw APIError.unauthorized()
    }

    const tierInfo = await getUserTierInfo(session.user.id)
    const userTier = (tierInfo?.tier?.tiers?.name ?? "free") as "free" | "pro"

    if (userTier !== "pro") {
      throw APIError.forbidden(
        "Audit logs are a Pro feature. Upgrade to access comprehensive audit trails.",
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse and validate pagination parameters
    const pagination = parseOffsetPagination(searchParams)

    // Parse filter parameters
    const eventType = searchParams.get("event_type")
    const eventCategory = searchParams.get("event_category")
    const resourceId = searchParams.get("resource_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const search = searchParams.get("search")

    const db = await getDatabase()

    const conditions = [eq(auditLogs.userId, session.user.id)]

    if (eventType) {
      conditions.push(eq(auditLogs.eventType, eventType as any))
    }

    if (eventCategory) {
      conditions.push(eq(auditLogs.eventCategory, eventCategory as any))
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId))
    }

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)))
    }

    if (search) {
      // Sanitize search input to prevent SQL injection in LIKE queries
      const sanitizedSearch = sanitizeString(search)
        .replace(/%/g, "\\%") // Escape LIKE wildcards
        .replace(/_/g, "\\_")

      if (sanitizedSearch) {
        conditions.push(
          or(
            like(auditLogs.eventType, `%${sanitizedSearch}%`),
            like(auditLogs.resourceType, `%${sanitizedSearch}%`),
          )!,
        )
      }
    }

    // Query logs with pagination
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset)

    // Get total count for pagination metadata
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(auditLogs)
      .where(and(...conditions))

    // Return standardized paginated response
    return NextResponse.json(
      buildOffsetPaginatedResponse(logs, totalCount, pagination),
    )
  } catch (error) {
    return handleAPIError(error)
  }
}
