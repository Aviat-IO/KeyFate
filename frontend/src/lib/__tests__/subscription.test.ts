import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../db/drizzle", () => ({
  getDatabase: vi.fn(),
  secretsService: {},
}))

vi.mock("../db/schema", () => ({
  userSubscriptions: {},
  subscriptionTiers: {},
  secrets: {},
  secretRecipients: {},
}))

import {
  getUserTierInfo,
  canUserCreateSecret,
  calculateUserUsage,
  getTierLimits,
  isIntervalAllowed,
  getAvailableIntervals,
} from "../subscription"
import { getDatabase } from "../db/drizzle"
import * as subscriptionModule from "../subscription"

const createMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  sql: vi.fn(),
})

describe("Subscription Tier Management", () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockDb = createMockDb()
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any)
  })

  describe("getUserTierInfo", () => {
    it("should return free tier info for users without subscription", async () => {
      vi.spyOn(subscriptionModule, "calculateUserUsage").mockResolvedValue({
        secrets_count: 0,
        total_recipients: 0,
      })

      mockDb.select.mockReturnValue(mockDb)
      mockDb.from.mockReturnValue(mockDb)
      mockDb.leftJoin.mockReturnValue(mockDb)
      mockDb.where.mockReturnValue(mockDb)
      mockDb.limit.mockResolvedValue([])

      const result = await getUserTierInfo("user-123")

      expect(result).toBeDefined()
      expect(result?.tier.tiers.name).toBe("free")
      expect(result?.tier.tiers.max_secrets).toBe(1)
      expect(result?.tier.tiers.max_recipients_per_secret).toBe(1)
      expect(result?.tier.tiers.custom_intervals).toBe(false)
    })

    it("should return pro tier info for subscribed users", async () => {
      const mockSubscription = {
        id: "sub-123",
        userId: "user-123",
        tier: {
          id: "tier-pro",
          name: "pro",
          displayName: "Pro",
          maxSecrets: 10,
          maxRecipientsPerSecret: 5,
          customIntervals: true,
          priceMonthly: "9.00",
          priceYearly: "90.00",
        },
        status: "active",
      }

      vi.spyOn(subscriptionModule, "calculateUserUsage").mockResolvedValue({
        secrets_count: 3,
        total_recipients: 2,
      })

      mockDb.select.mockReturnValue(mockDb)
      mockDb.from.mockReturnValue(mockDb)
      mockDb.leftJoin.mockReturnValue(mockDb)
      mockDb.where.mockReturnValue(mockDb)
      mockDb.limit.mockResolvedValue([mockSubscription])

      const result = await getUserTierInfo("user-123")

      expect(result).toBeDefined()
      expect(result?.tier.tiers.name).toBe("pro")
      expect(result?.tier.tiers.max_secrets).toBe(10)
      expect(result?.tier.tiers.max_recipients_per_secret).toBe(5)
      expect(result?.tier.tiers.custom_intervals).toBe(true)
      expect(result?.usage.secrets_count).toBe(3)
      expect(result?.usage.total_recipients).toBe(2)
    })

    it("should calculate canCreate flag correctly", async () => {
      vi.spyOn(subscriptionModule, "calculateUserUsage").mockResolvedValue({
        secrets_count: 1,
        total_recipients: 1,
      })

      mockDb.select.mockReturnValue(mockDb)
      mockDb.from.mockReturnValue(mockDb)
      mockDb.leftJoin.mockReturnValue(mockDb)
      mockDb.where.mockReturnValue(mockDb)
      mockDb.limit.mockResolvedValue([])

      const result = await getUserTierInfo("user-123")

      expect(result?.limits.secrets.canCreate).toBe(false)
      expect(result?.limits.secrets.current).toBe(1)
      expect(result?.limits.secrets.max).toBe(1)
    })

    it("should handle database errors gracefully", async () => {
      vi.mocked(getDatabase).mockRejectedValue(new Error("Database error"))

      const result = await getUserTierInfo("user-123")

      expect(result).toBeNull()
    })
  })

  describe("canUserCreateSecret", () => {
    it("should return true when user can create secrets", async () => {
      vi.spyOn(subscriptionModule, "calculateUserUsage").mockResolvedValue({
        secrets_count: 0,
        total_recipients: 0,
      })

      mockDb.select.mockReturnValue(mockDb)
      mockDb.from.mockReturnValue(mockDb)
      mockDb.leftJoin.mockReturnValue(mockDb)
      mockDb.where.mockReturnValue(mockDb)
      mockDb.limit.mockResolvedValue([])

      const result = await canUserCreateSecret("user-123")

      expect(result).toBe(true)
    })

    it("should return false when user is at secret limit", async () => {
      mockDb.limit.mockResolvedValue([])
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ secrets_count: 1 }]),
        }),
      })
      mockDb.from = vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockResolvedValue([{ recipientEmail: "user1@test.com" }]),
      })

      const result = await canUserCreateSecret("user-123")

      expect(result).toBe(false)
    })

    it("should return false on error", async () => {
      vi.mocked(getDatabase).mockRejectedValue(new Error("Database error"))

      const result = await canUserCreateSecret("user-123")

      expect(result).toBe(false)
    })
  })

  describe("calculateUserUsage", () => {
    it("should count active secrets correctly", async () => {
      const mockQueries = [
        [{ secrets_count: 5 }],
        [
          { id: "secret-1" },
          { id: "secret-2" },
          { id: "secret-3" },
          { id: "secret-4" },
          { id: "secret-5" },
        ],
        [
          { email: "user1@test.com" },
          { email: "user2@test.com" },
          { email: "user3@test.com" },
        ],
      ]
      let queryIndex = 0

      mockDb.sql = vi.fn()
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            const result = mockQueries[queryIndex]
            queryIndex++
            return result
          }),
        }),
      }))

      const result = await calculateUserUsage("user-123")

      expect(result.secrets_count).toBe(5)
      expect(result.total_recipients).toBe(3)
    })

    it("should count unique recipients only", async () => {
      const mockQueries = [
        [{ secrets_count: 3 }],
        [{ id: "secret-1" }, { id: "secret-2" }, { id: "secret-3" }],
        [
          { email: "user1@test.com" },
          { email: "user1@test.com" },
          { email: "user2@test.com" },
        ],
      ]
      let queryIndex = 0

      mockDb.sql = vi.fn()
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            const result = mockQueries[queryIndex]
            queryIndex++
            return result
          }),
        }),
      }))

      const result = await calculateUserUsage("user-123")

      expect(result.total_recipients).toBe(2)
    })

    it("should ignore null recipient emails", async () => {
      const mockQueries = [
        [{ secrets_count: 2 }],
        [{ id: "secret-1" }, { id: "secret-2" }],
        [{ email: "user1@test.com" }, { email: null }],
      ]
      let queryIndex = 0

      mockDb.sql = vi.fn()
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            const result = mockQueries[queryIndex]
            queryIndex++
            return result
          }),
        }),
      }))

      const result = await calculateUserUsage("user-123")

      expect(result.total_recipients).toBe(1)
    })

    it("should return zeros on error", async () => {
      vi.mocked(getDatabase).mockRejectedValue(new Error("Database error"))

      const result = await calculateUserUsage("user-123")

      expect(result.secrets_count).toBe(0)
      expect(result.total_recipients).toBe(0)
    })
  })

  describe("getTierLimits", () => {
    it("should return correct limits for free tier", () => {
      const limits = getTierLimits("free")

      expect(limits.maxSecrets).toBe(1)
      expect(limits.maxRecipientsPerSecret).toBe(1)
      expect(limits.customIntervals).toBe(false)
    })

    it("should return correct limits for pro tier", () => {
      const limits = getTierLimits("pro")

      expect(limits.maxSecrets).toBe(10)
      expect(limits.maxRecipientsPerSecret).toBe(5)
      expect(limits.customIntervals).toBe(true)
    })
  })

  describe("isIntervalAllowed", () => {
    it("should allow free tier intervals for free users", () => {
      expect(isIntervalAllowed("free", 7)).toBe(true)
      expect(isIntervalAllowed("free", 30)).toBe(true)
      expect(isIntervalAllowed("free", 365)).toBe(true)
    })

    it("should reject non-allowed intervals for free users", () => {
      expect(isIntervalAllowed("free", 1)).toBe(false)
      expect(isIntervalAllowed("free", 3)).toBe(false)
      expect(isIntervalAllowed("free", 14)).toBe(false)
      expect(isIntervalAllowed("free", 90)).toBe(false)
      expect(isIntervalAllowed("free", 180)).toBe(false)
    })

    it("should allow all pro intervals for pro users", () => {
      expect(isIntervalAllowed("pro", 1)).toBe(true)
      expect(isIntervalAllowed("pro", 3)).toBe(true)
      expect(isIntervalAllowed("pro", 7)).toBe(true)
      expect(isIntervalAllowed("pro", 14)).toBe(true)
      expect(isIntervalAllowed("pro", 30)).toBe(true)
      expect(isIntervalAllowed("pro", 90)).toBe(true)
      expect(isIntervalAllowed("pro", 180)).toBe(true)
      expect(isIntervalAllowed("pro", 365)).toBe(true)
      expect(isIntervalAllowed("pro", 1095)).toBe(true)
    })

    it("should reject invalid intervals for pro users", () => {
      expect(isIntervalAllowed("pro", 2)).toBe(false)
      expect(isIntervalAllowed("pro", 15)).toBe(false)
      expect(isIntervalAllowed("pro", 60)).toBe(false)
    })
  })

  describe("getAvailableIntervals", () => {
    it("should return 3 intervals for free tier", () => {
      const intervals = getAvailableIntervals("free")

      expect(intervals).toHaveLength(3)
      expect(intervals[0]).toEqual({ days: 7, label: "1 week" })
      expect(intervals[1]).toEqual({ days: 30, label: "1 month" })
      expect(intervals[2]).toEqual({ days: 365, label: "1 year" })
    })

    it("should return 9 intervals for pro tier", () => {
      const intervals = getAvailableIntervals("pro")

      expect(intervals).toHaveLength(9)
      expect(intervals[0]).toEqual({ days: 1, label: "1 day" })
      expect(intervals[8]).toEqual({ days: 1095, label: "3 years" })
    })
  })
})
