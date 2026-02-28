import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getDatabase } from "$lib/db/drizzle"
import { userSubscriptions } from "$lib/db/schema"
import { subscriptionService } from "$lib/services/subscription-service"
import { and, lte, eq, isNotNull, sql } from "drizzle-orm"

function authorize(request: Request): boolean {
  const header =
    request.headers.get("authorization") || request.headers.get("Authorization")

  if (!header?.startsWith("Bearer ")) {
    return false
  }

  const token = header.slice(7).trim()
  const cronSecret = process.env.CRON_SECRET

  return !!cronSecret && token === cronSecret
}

export const GET: RequestHandler = async (event) => {
  if (!authorize(event.request)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({
    status: "ok",
    job: "process-subscription-downgrades",
  })
}

export const POST: RequestHandler = async (event) => {
  if (!authorize(event.request)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = new Date()
  console.log(
    `[process-downgrades] Cron job started at ${startTime.toISOString()}`,
  )

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

    console.log(
      `[process-downgrades] Found ${eligibleSubscriptions.length} eligible downgrades`,
    )

    let downgradesProcessed = 0
    let downgradesSuccessful = 0
    let downgradesFailed = 0
    const errors: Array<{ userId: string; error: string }> = []

    for (const subscription of eligibleSubscriptions) {
      downgradesProcessed++

      try {
        console.log(
          `[process-downgrades] Processing downgrade for user ${subscription.userId}`,
        )

        await subscriptionService.executeScheduledDowngrade(subscription.userId)

        downgradesSuccessful++
        console.log(
          `[process-downgrades] Successfully downgraded user ${subscription.userId}`,
        )
      } catch (error) {
        downgradesFailed++
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        errors.push({
          userId: subscription.userId,
          error: errorMessage,
        })
        console.error(
          `[process-downgrades] Failed to downgrade user ${subscription.userId}:`,
          error,
        )
      }
    }

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    console.log(
      `[process-downgrades] Cron job completed in ${duration}ms. Processed: ${downgradesProcessed}, Successful: ${downgradesSuccessful}, Failed: ${downgradesFailed}`,
    )

    return json({
      downgradesProcessed,
      downgradesSuccessful,
      downgradesFailed,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: endTime.toISOString(),
      durationMs: duration,
    })
  } catch (error) {
    console.error("[process-downgrades] Fatal error:", error)

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
