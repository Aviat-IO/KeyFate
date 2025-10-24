import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { subscriptionService } from "@/lib/services/subscription-service"
import { getDatabase } from "@/lib/db/drizzle"
import { logSubscriptionChanged } from "@/lib/services/audit-logger"
import { getFiatPaymentProvider } from "@/lib/payment"

vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
}))

vi.mock("@/lib/services/audit-logger", () => ({
  logSubscriptionChanged: vi.fn(),
}))

vi.mock("@/lib/payment", () => ({
  getFiatPaymentProvider: vi.fn(),
}))

vi.mock("@/lib/services/email-service", () => ({
  emailService: {
    sendSubscriptionCancelled: vi.fn(),
  },
}))

describe("SubscriptionService - Downgrade Methods (TDD)", () => {
  let mockDb: any
  let mockStripeProvider: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
    }

    vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

    mockStripeProvider = {
      getProviderName: vi.fn().mockReturnValue("Stripe"),
      updateSubscription: vi.fn().mockResolvedValue({
        id: "sub_123",
        status: "active",
        cancel_at_period_end: false,
      }),
    }

    vi.mocked(getFiatPaymentProvider).mockReturnValue(mockStripeProvider as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("scheduleDowngrade", () => {
    it("should schedule downgrade for Stripe Pro user at period end", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-123",
        tierId: "tier-pro",
        provider: "stripe",
        providerSubscriptionId: "sub_stripe123",
        status: "active",
        currentPeriodEnd: new Date("2025-02-01"),
        cancelAtPeriodEnd: false,
        scheduledDowngradeAt: null,
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])
      mockDb.returning.mockResolvedValueOnce([
        {
          ...mockSubscription,
          scheduledDowngradeAt: new Date("2025-02-01"),
        },
      ])

      const result = await subscriptionService.scheduleDowngrade("user-123")

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDowngradeAt: expect.any(Date),
        }),
      )
      expect(mockStripeProvider.updateSubscription).toHaveBeenCalledWith(
        "sub_stripe123",
        { cancelAtPeriodEnd: true },
      )
      expect(logSubscriptionChanged).toHaveBeenCalledWith("user-123", {
        action: "downgrade_scheduled",
        scheduledFor: expect.any(Date),
        resourceType: "subscription",
        resourceId: "downgrade:free",
      })
      expect(result.scheduledDowngradeAt).toBeDefined()
    })

    it("should schedule downgrade for BTCPay Pro user using currentPeriodEnd", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-456",
        tierId: "tier-pro",
        provider: "btcpay",
        providerSubscriptionId: null,
        status: "active",
        currentPeriodEnd: new Date("2025-03-15"),
        cancelAtPeriodEnd: false,
        scheduledDowngradeAt: null,
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])
      mockDb.returning.mockResolvedValueOnce([
        {
          ...mockSubscription,
          scheduledDowngradeAt: new Date("2025-03-15"),
        },
      ])

      const result = await subscriptionService.scheduleDowngrade("user-456")

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDowngradeAt: new Date("2025-03-15"),
        }),
      )
      expect(mockStripeProvider.updateSubscription).not.toHaveBeenCalled()
      expect(result.scheduledDowngradeAt).toEqual(new Date("2025-03-15"))
    })

    it("should throw error if user has no subscription", async () => {
      mockDb.limit.mockResolvedValueOnce([])

      await expect(
        subscriptionService.scheduleDowngrade("user-no-sub"),
      ).rejects.toThrow("No active subscription found")
    })

    it("should throw error if subscription is already cancelled", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-cancelled",
        status: "cancelled",
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])

      await expect(
        subscriptionService.scheduleDowngrade("user-cancelled"),
      ).rejects.toThrow("Cannot schedule downgrade for cancelled subscription")
    })

    it("should return existing scheduled downgrade if already scheduled", async () => {
      const existingDate = new Date("2025-02-01")
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-already-scheduled",
        tierId: "tier-pro",
        provider: "stripe",
        status: "active",
        scheduledDowngradeAt: existingDate,
        currentPeriodEnd: existingDate,
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])

      const result = await subscriptionService.scheduleDowngrade(
        "user-already-scheduled",
      )

      expect(mockDb.update).not.toHaveBeenCalled()
      expect(result.scheduledDowngradeAt).toEqual(existingDate)
    })

    it("should throw error if currentPeriodEnd is missing", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-no-period",
        provider: "btcpay",
        status: "active",
        currentPeriodEnd: null,
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])

      await expect(
        subscriptionService.scheduleDowngrade("user-no-period"),
      ).rejects.toThrow(
        "Cannot schedule downgrade: currentPeriodEnd is missing",
      )
    })
  })

  describe("cancelScheduledDowngrade", () => {
    it("should cancel scheduled downgrade for Stripe user", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-123",
        provider: "stripe",
        providerSubscriptionId: "sub_stripe123",
        status: "active",
        scheduledDowngradeAt: new Date("2025-02-01"),
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])
      mockDb.returning.mockResolvedValueOnce([
        {
          ...mockSubscription,
          scheduledDowngradeAt: null,
        },
      ])

      const result =
        await subscriptionService.cancelScheduledDowngrade("user-123")

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDowngradeAt: null,
        }),
      )
      expect(mockStripeProvider.updateSubscription).toHaveBeenCalledWith(
        "sub_stripe123",
        { cancelAtPeriodEnd: false },
      )
      expect(logSubscriptionChanged).toHaveBeenCalledWith("user-123", {
        action: "downgrade_cancelled",
        resourceType: "subscription",
        resourceId: "downgrade:cancelled",
      })
      expect(result.scheduledDowngradeAt).toBeNull()
    })

    it("should cancel scheduled downgrade for BTCPay user", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-456",
        provider: "btcpay",
        providerSubscriptionId: null,
        status: "active",
        scheduledDowngradeAt: new Date("2025-03-15"),
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])
      mockDb.returning.mockResolvedValueOnce([
        {
          ...mockSubscription,
          scheduledDowngradeAt: null,
        },
      ])

      const result =
        await subscriptionService.cancelScheduledDowngrade("user-456")

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockStripeProvider.updateSubscription).not.toHaveBeenCalled()
      expect(result.scheduledDowngradeAt).toBeNull()
    })

    it("should throw error if no downgrade is scheduled", async () => {
      const mockSubscription = {
        id: "sub-uuid",
        userId: "user-no-downgrade",
        status: "active",
        scheduledDowngradeAt: null,
      }

      mockDb.limit.mockResolvedValueOnce([mockSubscription])

      await expect(
        subscriptionService.cancelScheduledDowngrade("user-no-downgrade"),
      ).rejects.toThrow("No scheduled downgrade found")
    })

    it("should throw error if user has no subscription", async () => {
      mockDb.limit.mockResolvedValueOnce([])

      await expect(
        subscriptionService.cancelScheduledDowngrade("user-no-sub"),
      ).rejects.toThrow("No subscription found")
    })
  })

  describe("executeScheduledDowngrade", () => {
    it("should downgrade user to free tier and send email", async () => {
      const mockTier = {
        id: "tier-free",
        name: "free",
      }

      mockDb.limit.mockResolvedValueOnce([mockTier])
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "sub-uuid",
          userId: "user-123",
          tierId: "tier-free",
          status: "cancelled",
          scheduledDowngradeAt: null,
        },
      ])

      const result =
        await subscriptionService.executeScheduledDowngrade("user-123")

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          tierId: "tier-free",
          status: "cancelled",
          scheduledDowngradeAt: null,
        }),
      )
      expect(logSubscriptionChanged).toHaveBeenCalledWith("user-123", {
        action: "downgrade_executed",
        from: expect.any(String),
        to: "free",
        resourceType: "subscription",
        resourceId: expect.stringMatching(/:free$/),
      })
    })

    it("should throw error if free tier not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([])
      mockDb.returning.mockResolvedValueOnce([])

      await expect(
        subscriptionService.executeScheduledDowngrade("user-123"),
      ).rejects.toThrow()
    })
  })
})
