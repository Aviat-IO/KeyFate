import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getDatabase } from "@/lib/db/drizzle"
import { webhookEvents } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import {
  recordWebhookEvent,
  isWebhookDuplicate,
} from "@/lib/webhooks/deduplication"

describe("Webhook Replay Protection", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>

  beforeEach(async () => {
    db = await getDatabase()
  })

  afterEach(async () => {
    // Clean up test webhook events
    await db
      .delete(webhookEvents)
      .where(eq(webhookEvents.provider, "test-provider"))
  })

  describe("recordWebhookEvent", () => {
    it("should record new webhook events", async () => {
      const eventId = `test-event-${Date.now()}`
      const result = await recordWebhookEvent(
        "test-provider",
        eventId,
        "payment.success",
      )

      expect(result.success).toBe(true)
      expect(result.duplicate).toBe(false)

      // Verify event was recorded
      const events = await db
        .select()
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, "test-provider"),
            eq(webhookEvents.eventId, eventId),
          ),
        )

      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe("payment.success")
    })

    it("should detect duplicate webhook events", async () => {
      const eventId = `test-event-${Date.now()}`

      // Record first time
      const result1 = await recordWebhookEvent(
        "test-provider",
        eventId,
        "payment.success",
      )
      expect(result1.success).toBe(true)
      expect(result1.duplicate).toBe(false)

      // Try to record again
      const result2 = await recordWebhookEvent(
        "test-provider",
        eventId,
        "payment.success",
      )
      expect(result2.success).toBe(true)
      expect(result2.duplicate).toBe(true)

      // Should still only have one record
      const events = await db
        .select()
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, "test-provider"),
            eq(webhookEvents.eventId, eventId),
          ),
        )

      expect(events).toHaveLength(1)
    })

    it("should allow same event ID from different providers", async () => {
      const eventId = `test-event-${Date.now()}`

      // Record from provider 1
      const result1 = await recordWebhookEvent(
        "stripe",
        eventId,
        "payment.success",
      )
      expect(result1.duplicate).toBe(false)

      // Record from provider 2 with same event ID
      const result2 = await recordWebhookEvent(
        "btcpay",
        eventId,
        "payment.success",
      )
      expect(result2.duplicate).toBe(false)

      // Clean up
      await db.delete(webhookEvents).where(eq(webhookEvents.eventId, eventId))
    })
  })

  describe("isWebhookDuplicate", () => {
    it("should return false for new events", async () => {
      const eventId = `test-event-${Date.now()}`
      const isDupe = await isWebhookDuplicate("test-provider", eventId)

      expect(isDupe).toBe(false)
    })

    it("should return true for existing events", async () => {
      const eventId = `test-event-${Date.now()}`

      // Record event first
      await recordWebhookEvent("test-provider", eventId, "payment.success")

      // Check if duplicate
      const isDupe = await isWebhookDuplicate("test-provider", eventId)
      expect(isDupe).toBe(true)
    })
  })

  describe("Stripe Webhook Endpoint", () => {
    it("should accept new webhook events", async () => {
      // This would be a full integration test with Stripe
      // For now, we'll test the deduplication logic
      const eventId = `evt_test_${Date.now()}`

      const result = await recordWebhookEvent(
        "stripe",
        eventId,
        "checkout.session.completed",
      )

      expect(result.success).toBe(true)
      expect(result.duplicate).toBe(false)

      // Clean up
      await db
        .delete(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, "stripe"),
            eq(webhookEvents.eventId, eventId),
          ),
        )
    })

    it("should reject duplicate Stripe webhooks", async () => {
      const eventId = `evt_test_${Date.now()}`

      // First webhook
      await recordWebhookEvent("stripe", eventId, "checkout.session.completed")

      // Duplicate webhook (replay attack)
      const isDupe = await isWebhookDuplicate("stripe", eventId)
      expect(isDupe).toBe(true)

      // Clean up
      await db
        .delete(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, "stripe"),
            eq(webhookEvents.eventId, eventId),
          ),
        )
    })
  })

  describe("BTCPay Webhook Endpoint", () => {
    it("should accept new BTCPay webhook events", async () => {
      const eventId = `btcpay_${Date.now()}`

      const result = await recordWebhookEvent("btcpay", eventId, "invoice.paid")

      expect(result.success).toBe(true)
      expect(result.duplicate).toBe(false)

      // Clean up
      await db
        .delete(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, "btcpay"),
            eq(webhookEvents.eventId, eventId),
          ),
        )
    })

    it("should reject duplicate BTCPay webhooks", async () => {
      const eventId = `btcpay_${Date.now()}`

      // First webhook
      await recordWebhookEvent("btcpay", eventId, "invoice.paid")

      // Duplicate webhook (replay attack)
      const isDupe = await isWebhookDuplicate("btcpay", eventId)
      expect(isDupe).toBe(true)

      // Clean up
      await db
        .delete(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, "btcpay"),
            eq(webhookEvents.eventId, eventId),
          ),
        )
    })
  })

  describe("Webhook Retention", () => {
    it("should identify old webhook events for cleanup", async () => {
      const db = await getDatabase()

      // Record an old event (31 days ago)
      const oldEventId = `old-event-${Date.now()}`
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 31)

      await db.insert(webhookEvents).values({
        provider: "test-provider",
        eventId: oldEventId,
        eventType: "test.event",
        receivedAt: oldDate,
      })

      // Query for events older than 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const oldEvents = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.provider, "test-provider"))

      const eventsToCleanup = oldEvents.filter(
        (e) => e.receivedAt < thirtyDaysAgo,
      )

      expect(eventsToCleanup.length).toBeGreaterThan(0)

      // Clean up
      await db
        .delete(webhookEvents)
        .where(eq(webhookEvents.eventId, oldEventId))
    })
  })
})
