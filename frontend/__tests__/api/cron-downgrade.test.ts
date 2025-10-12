import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
}))

vi.mock("@/lib/services/subscription-service", () => ({
  subscriptionService: {
    executeScheduledDowngrade: vi.fn(),
    getTierByName: vi.fn(),
  },
}))

vi.mock("@/lib/services/email-service", () => ({
  emailService: {
    sendSubscriptionCancelled: vi.fn(),
  },
}))

describe("Cron Job - Process Subscription Downgrades (TDD)", () => {
  let mockDb: any

  beforeEach(async () => {
    vi.clearAllMocks()

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }

    const { getDatabase } = await import("@/lib/db/drizzle")
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any)
  })

  describe("POST /api/cron/process-subscription-downgrades", () => {
    it("should return 401 for missing authorization header", async () => {
      const { POST } = await import(
        "@/app/api/cron/process-subscription-downgrades/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/cron/process-subscription-downgrades",
        {
          method: "POST",
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })

    it("should return 401 for invalid CRON_SECRET", async () => {
      const { POST } = await import(
        "@/app/api/cron/process-subscription-downgrades/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/cron/process-subscription-downgrades",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer invalid-secret",
          },
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })

    it("should process eligible downgrades with valid CRON_SECRET", async () => {
      process.env.CRON_SECRET = "test-cron-secret"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: "sub-1",
          userId: "user-1",
          scheduledDowngradeAt: new Date("2025-01-01"),
          status: "active",
        },
        {
          id: "sub-2",
          userId: "user-2",
          scheduledDowngradeAt: new Date("2025-01-02"),
          status: "active",
        },
      ])

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.executeScheduledDowngrade)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any)

      const { POST } = await import(
        "@/app/api/cron/process-subscription-downgrades/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/cron/process-subscription-downgrades",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-cron-secret",
          },
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.downgradesProcessed).toBe(2)
      expect(data.downgradesSuccessful).toBe(2)
      expect(data.downgradesFailed).toBe(0)
      expect(
        subscriptionService.executeScheduledDowngrade,
      ).toHaveBeenCalledTimes(2)
    })

    it("should return success with no downgrades when none are eligible", async () => {
      process.env.CRON_SECRET = "test-cron-secret"

      mockDb.limit.mockResolvedValueOnce([])

      const { POST } = await import(
        "@/app/api/cron/process-subscription-downgrades/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/cron/process-subscription-downgrades",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-cron-secret",
          },
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.downgradesProcessed).toBe(0)
      expect(data.downgradesSuccessful).toBe(0)
      expect(data.downgradesFailed).toBe(0)
    })

    it("should handle partial failures gracefully", async () => {
      process.env.CRON_SECRET = "test-cron-secret"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: "sub-1",
          userId: "user-1",
          scheduledDowngradeAt: new Date("2025-01-01"),
          status: "active",
        },
        {
          id: "sub-2",
          userId: "user-2",
          scheduledDowngradeAt: new Date("2025-01-02"),
          status: "active",
        },
        {
          id: "sub-3",
          userId: "user-3",
          scheduledDowngradeAt: new Date("2025-01-03"),
          status: "active",
        },
      ])

      const { subscriptionService } = await import(
        "@/lib/services/subscription-service"
      )
      vi.mocked(subscriptionService.executeScheduledDowngrade)
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce({} as any)

      const { POST } = await import(
        "@/app/api/cron/process-subscription-downgrades/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/cron/process-subscription-downgrades",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-cron-secret",
          },
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.downgradesProcessed).toBe(3)
      expect(data.downgradesSuccessful).toBe(2)
      expect(data.downgradesFailed).toBe(1)
      expect(data.errors).toHaveLength(1)
    })

    it("should return 500 for database connection errors", async () => {
      process.env.CRON_SECRET = "test-cron-secret"

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockRejectedValueOnce(
        new Error("Database connection failed"),
      )

      const { POST } = await import(
        "@/app/api/cron/process-subscription-downgrades/route"
      )

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/cron/process-subscription-downgrades",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-cron-secret",
          },
        },
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Failed to process downgrades")
    })
  })
})
