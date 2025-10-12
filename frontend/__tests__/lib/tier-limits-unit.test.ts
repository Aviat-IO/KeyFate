import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { eq, and, count } from "drizzle-orm"

vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
}))

vi.mock("@/lib/db/schema", () => ({
  secrets: {
    id: "id",
    userId: "userId",
    status: "status",
  },
  secretRecipients: {
    secretId: "secretId",
    email: "email",
  },
  userSubscriptions: {},
  subscriptionTiers: {},
}))

describe("Tier Limits - Unit Tests", () => {
  describe("calculateUserUsage", () => {
    it("should count active and paused secrets", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ secrets_count: 2 }]),
      }

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const { calculateUserUsage } = await import("@/lib/subscription")

      const usage = await calculateUserUsage("user-123")

      expect(mockDb.where).toHaveBeenCalled()
      const whereCall = mockDb.where.mock.calls[0][0]
      expect(whereCall).toBeDefined()
    })

    it("should not count triggered secrets", async () => {
      const mockCountableSecrets = [{ id: "secret-1" }]

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi
          .fn()
          .mockResolvedValueOnce([{ secrets_count: 1 }])
          .mockResolvedValueOnce(mockCountableSecrets)
          .mockResolvedValueOnce([]),
        sql: vi.fn(),
      }

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const { calculateUserUsage } = await import("@/lib/subscription")

      const usage = await calculateUserUsage("user-123")

      expect(usage.secrets_count).toBe(1)
    })

    it("should count paused secrets", async () => {
      const mockCountableSecrets = [{ id: "secret-1" }, { id: "secret-2" }]

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi
          .fn()
          .mockResolvedValueOnce([{ secrets_count: 2 }])
          .mockResolvedValueOnce(mockCountableSecrets)
          .mockResolvedValueOnce([]),
        sql: vi.fn(),
      }

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const { calculateUserUsage } = await import("@/lib/subscription")

      const usage = await calculateUserUsage("user-123")

      expect(usage.secrets_count).toBe(2)
    })
  })

  describe("canUserCreateSecret", () => {
    it("should return true when user has 0 active secrets and free tier limit is 1", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ secrets_count: 0 }])
          .mockResolvedValueOnce([]),
        limit: vi.fn().mockReturnThis(),
        sql: vi.fn(),
      }

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const { canUserCreateSecret } = await import("@/lib/subscription")

      const canCreate = await canUserCreateSecret("user-123")

      expect(canCreate).toBe(true)
    })

    it("should return false when user has 1 active secret and free tier limit is 1", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ secrets_count: 1 }])
          .mockResolvedValueOnce([{ id: "secret-1" }]),
        limit: vi.fn().mockReturnThis(),
        sql: vi.fn(),
      }

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const { canUserCreateSecret } = await import("@/lib/subscription")

      const canCreate = await canUserCreateSecret("user-123")

      expect(canCreate).toBe(false)
    })

    it("should return false when user has 1 paused secret (counted) and free tier limit is 1", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ secrets_count: 1 }])
          .mockResolvedValueOnce([{ id: "secret-1" }]),
        limit: vi.fn().mockReturnThis(),
        sql: vi.fn(),
      }

      const { getDatabase } = await import("@/lib/db/drizzle")
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const { canUserCreateSecret } = await import("@/lib/subscription")

      const canCreate = await canUserCreateSecret("user-123")

      expect(canCreate).toBe(false)
    })
  })
})
