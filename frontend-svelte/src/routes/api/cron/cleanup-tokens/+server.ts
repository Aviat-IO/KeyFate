import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getDatabase } from "$lib/db/drizzle"
import { csrfTokens } from "$lib/db/schema"
import { lt } from "drizzle-orm"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { adaptRequestEvent } from "$lib/cron/adapt-request"

export const GET: RequestHandler = async (event) => {
  const req = adaptRequestEvent(event)
  if (!authorizeRequest(req)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "cleanup-tokens" })
}

export const POST: RequestHandler = async (event) => {
  try {
    const req = adaptRequestEvent(event)
    if (!authorizeRequest(req)) {
      return json({ error: "Unauthorized" }, { status: 401 })
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

    return json({
      success: true,
      deletedCount: deletedTokens.length,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    logger.error("Failed to cleanup CSRF tokens", error as Error)
    return json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
