import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db/drizzle"
import { csrfTokens } from "@/lib/db/schema"
import { lt } from "drizzle-orm"
import { logger } from "@/lib/logger"
import { authorizeRequest } from "@/lib/cron/utils"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ status: "ok", job: "cleanup-tokens" })
}

export async function POST(req: NextRequest) {
  try {
    if (!authorizeRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    const now = new Date()

    // Delete expired CSRF tokens
    const deletedTokens = await db
      .delete(csrfTokens)
      .where(lt(csrfTokens.expiresAt, now))
      .returning({ id: csrfTokens.id })

    logger.info("Cleaned up expired CSRF tokens", {
      deletedCount: deletedTokens.length,
      timestamp: now.toISOString(),
    })

    return NextResponse.json({
      success: true,
      deletedCount: deletedTokens.length,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    logger.error("Failed to cleanup CSRF tokens", error as Error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
