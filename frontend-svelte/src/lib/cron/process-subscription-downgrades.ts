/**
 * Core logic for the process-subscription-downgrades cron job.
 *
 * Finds active subscriptions with a scheduled downgrade date in the past
 * and executes the downgrade.
 */

import { getDatabase } from "$lib/db/get-database"
import { userSubscriptions } from "$lib/db/schema"
import { subscriptionService } from "$lib/services/subscription-service"
import { logger } from "$lib/logger"
import { and, lte, eq, isNotNull, sql } from "drizzle-orm"

export interface ProcessSubscriptionDowngradesResult {
  processed: number
  succeeded: number
  failed: number
  downgradesProcessed: number
  downgradesSuccessful: number
  downgradesFailed: number
  errors?: Array<{ userId: string; error: string }>
  timestamp: string
  durationMs: number
}

export async function runProcessSubscriptionDowngrades(): Promise<ProcessSubscriptionDowngradesResult> {
  const startTime = new Date()
  logger.info("Cron job started", { startedAt: startTime.toISOString() })

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

  return {
    processed: downgradesProcessed,
    succeeded: downgradesSuccessful,
    failed: downgradesFailed,
    downgradesProcessed,
    downgradesSuccessful,
    downgradesFailed,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: endTime.toISOString(),
    durationMs: duration,
  }
}
