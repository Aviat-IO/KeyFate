import { describe, it, expect, vi } from "vitest"
import {
  updateDisclosureLog,
  shouldRetrySecret,
} from "@/lib/cron/disclosure-helpers"

describe("disclosure-helpers", () => {
  describe("shouldRetrySecret", () => {
    it("should return true when retry count is below max", () => {
      expect(shouldRetrySecret(0)).toBe(true)
      expect(shouldRetrySecret(1)).toBe(true)
      expect(shouldRetrySecret(4)).toBe(true)
    })

    it("should return false when retry count equals or exceeds max", () => {
      expect(shouldRetrySecret(5)).toBe(false)
      expect(shouldRetrySecret(6)).toBe(false)
      expect(shouldRetrySecret(10)).toBe(false)
    })
  })

  describe("updateDisclosureLog", () => {
    it("should update disclosure log with sent status", async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }

      const result = await updateDisclosureLog(
        mockDb as any,
        "log-id-123",
        "sent",
      )

      expect(result).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should update disclosure log with failed status and error", async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }

      const result = await updateDisclosureLog(
        mockDb as any,
        "log-id-123",
        "failed",
        "Email delivery failed",
      )

      expect(result).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should return false on database error", async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }

      const result = await updateDisclosureLog(
        mockDb as any,
        "log-id-123",
        "sent",
      )

      expect(result).toBe(false)
    })
  })
})
