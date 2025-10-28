import { getDatabase } from "@/lib/db/drizzle"
import { webhookEvents } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { logger } from "@/lib/logger"

export async function isWebhookProcessed(
  provider: "stripe" | "btcpay",
  eventId: string,
): Promise<boolean> {
  try {
    const db = await getDatabase()

    const existing = await db
      .select()
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, provider),
          eq(webhookEvents.eventId, eventId),
        ),
      )
      .limit(1)

    return existing.length > 0
  } catch (error) {
    logger.error("Failed to check webhook deduplication", error as Error, {
      provider,
      eventId,
    })
    return false
  }
}

export async function recordWebhookEvent(
  provider: "stripe" | "btcpay",
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<boolean> {
  try {
    const db = await getDatabase()

    await db.insert(webhookEvents).values({
      provider,
      eventId,
      eventType,
      payload: payload as any,
      status: "processed",
      processedAt: new Date(),
    } as any)

    return true
  } catch (error) {
    if ((error as any).code === "23505") {
      logger.info("Webhook already processed (duplicate)", {
        provider,
        eventId,
      })
      return false
    }

    logger.error("Failed to record webhook event", error as Error, {
      provider,
      eventId,
    })
    throw error
  }
}

export async function cleanupOldWebhookEvents(
  daysToKeep: number = 30,
): Promise<number> {
  try {
    const db = await getDatabase()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await db
      .delete(webhookEvents)
      .where(eq(webhookEvents.createdAt, cutoffDate))

    logger.info("Cleaned up old webhook events", {
      daysToKeep,
      cutoffDate: cutoffDate.toISOString(),
    })

    return 0
  } catch (error) {
    logger.error("Failed to cleanup webhook events", error as Error)
    return 0
  }
}
