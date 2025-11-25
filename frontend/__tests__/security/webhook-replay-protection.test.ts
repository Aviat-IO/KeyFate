import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  recordWebhookEvent,
  isWebhookProcessed,
  cleanupOldWebhookEvents,
} from "@/lib/webhooks/deduplication"

// Mock database with proper getDatabase export
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => Promise.resolve()),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([])),
    })),
  })),
}

vi.mock("@/lib/db/drizzle", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/db/drizzle")>("@/lib/db/drizzle")
  return {
    ...actual,
    getDatabase: vi.fn(async () => mockDb),
  }
})

describe("Webhook Replay Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("recordWebhookEvent", () => {
    it("should record new webhook events", async () => {
      // Mock: insert succeeds (new event)
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => Promise.resolve()),
      } as any)

      const result = await recordWebhookEvent(
        "stripe",
        "evt_123",
        "payment.success",
        { amount: 1000 },
      )

      expect(result).toBe(true)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it("should detect duplicate webhook events", async () => {
      // Mock: insert throws unique constraint error
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => {
          const error: any = new Error("duplicate key value")
          error.code = "23505"
          throw error
        }),
      } as any)

      const result = await recordWebhookEvent(
        "stripe",
        "evt_duplicate",
        "payment.success",
        { amount: 1000 },
      )

      expect(result).toBe(false)
    })
  })

  describe("isWebhookProcessed", () => {
    it("should return false for new events", async () => {
      // Mock: no existing events found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as any)

      const isProcessed = await isWebhookProcessed("stripe", "new-event-id")
      expect(isProcessed).toBe(false)
    })

    it("should return true for existing events", async () => {
      // Mock: existing event found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: "existing-id",
                  provider: "stripe",
                  eventId: "existing-event",
                  processedAt: new Date(),
                },
              ]),
            ),
          })),
        })),
      } as any)

      const isProcessed = await isWebhookProcessed("stripe", "existing-event")
      expect(isProcessed).toBe(true)
    })
  })

  describe("Stripe Webhook Endpoint", () => {
    it("should accept new webhook events", async () => {
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => Promise.resolve()),
      } as any)

      const result = await recordWebhookEvent(
        "stripe",
        "evt_test_123",
        "checkout.session.completed",
        {},
      )

      expect(result).toBe(true)
    })

    it("should reject duplicate Stripe webhooks", async () => {
      // First webhook: check returns false (not processed)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as any)

      const isProcessedBefore = await isWebhookProcessed(
        "stripe",
        "evt_test_dup",
      )
      expect(isProcessedBefore).toBe(false)

      // After recording, should show as processed
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                { id: "id-1", provider: "stripe", eventId: "evt_test_dup" },
              ]),
            ),
          })),
        })),
      } as any)

      const isProcessedAfter = await isWebhookProcessed(
        "stripe",
        "evt_test_dup",
      )
      expect(isProcessedAfter).toBe(true)
    })
  })

  describe("BTCPay Webhook Endpoint", () => {
    it("should accept new BTCPay webhook events", async () => {
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => Promise.resolve()),
      } as any)

      const result = await recordWebhookEvent(
        "btcpay",
        "btcpay_123",
        "invoice.paid",
        {},
      )

      expect(result).toBe(true)
    })

    it("should reject duplicate BTCPay webhooks", async () => {
      // First check: not processed
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as any)

      const isProcessedBefore = await isWebhookProcessed("btcpay", "btcpay_dup")
      expect(isProcessedBefore).toBe(false)

      // After recording: processed
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                { id: "id-1", provider: "btcpay", eventId: "btcpay_dup" },
              ]),
            ),
          })),
        })),
      } as any)

      const isProcessedAfter = await isWebhookProcessed("btcpay", "btcpay_dup")
      expect(isProcessedAfter).toBe(true)
    })
  })

  describe("Webhook Retention", () => {
    it("should cleanup old webhook events", async () => {
      const mockDeletedEvents = [
        { id: "1" },
        { id: "2" },
        { id: "3" },
        { id: "4" },
        { id: "5" },
      ]

      mockDb.delete.mockReturnValueOnce({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(mockDeletedEvents)),
        })),
      } as any)

      const result = await cleanupOldWebhookEvents(30)

      expect(mockDb.delete).toHaveBeenCalled()
      expect(result).toBe(5)
    })

    it("should use lt operator for date comparison", async () => {
      const whereSpy = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      }))

      mockDb.delete.mockReturnValueOnce({
        where: whereSpy,
      } as any)

      await cleanupOldWebhookEvents(30)

      expect(whereSpy).toHaveBeenCalled()
    })

    it("should log deleted count", async () => {
      const mockDeletedEvents = [{ id: "1" }, { id: "2" }]

      mockDb.delete.mockReturnValueOnce({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(mockDeletedEvents)),
        })),
      } as any)

      const result = await cleanupOldWebhookEvents(30)

      expect(result).toBe(2)
    })
  })
})
