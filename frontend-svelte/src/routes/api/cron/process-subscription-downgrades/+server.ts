import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { getDatabase } from "$lib/db/drizzle"
import { userSubscriptions } from "$lib/db/schema"
import { subscriptionService } from "$lib/services/subscription-service"
import { authorizeRequest } from "$lib/cron/utils"
import { and, lte, eq, isNotNull, sql } from "drizzle-orm"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({
    status: "ok",
    job: "process-subscription-downgrades",
  })
}

export const POST: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = new Date()
  logger.info("Cron job started", { startedAt: startTime.toISOString() })

  try {
    const db = await getDatabase()

    const now = new Date()

    const eligibleSubscriptions = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, "active"),
          isNotNull(userSubscriptions.scheduledDowngradeAt),
          lte(
            sql`${userSubscriptions.scheduledDowngradeAt}`,
            sql`${now.toISOString()}`,
          ),
        ),
      )
      .limit(100)

    logger.info("Found eligible downgrades", { count: eligibleSubscriptions.length })

    let downgradesProcessed = 0
    let downgradesSuccessful = 0
    let downgradesFailed = 0
    const errors: Array<{ userId: string; error: string }> = []

    for (const subscription of eligibleSubscriptions) {
      downgradesProcessed++

      try {
        logger.info("Processing downgrade", { userId: subscription.userId })

        await subscriptionService.executeScheduledDowngrade(subscription.userId)

        downgradesSuccessful++
        logger.info("Successfully downgraded user", { userId: subscription.userId })
      } catch (error) {
        downgradesFailed++
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        errors.push({
          userId: subscription.userId,
          error: errorMessage,
        })
        logger.error("Failed to downgrade user", error instanceof Error ? error : undefined, {
          userId: subscription.userId,
        })
      }
    }

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    logger.info("Cron job completed", {
      durationMs: duration,
      processed: downgradesProcessed,
      successful: downgradesSuccessful,
      failed: downgradesFailed,
    })

    return json({
      downgradesProcessed,
      downgradesSuccessful,
      downgradesFailed,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: endTime.toISOString(),
      durationMs: duration,
    })
  } catch (error) {
    logger.error("process-downgrades fatal error", error instanceof Error ? error : undefined)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return json(
      {
        error: "Failed to process downgrades",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
