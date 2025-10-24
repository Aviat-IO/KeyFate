import { describe, expect, it } from "vitest"
import { formatGranularTime } from "@/lib/time-utils"

describe("formatGranularTime", () => {
  describe("future dates - days", () => {
    it("formats >24 hours as days (plural)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days
      expect(formatGranularTime(future)).toBe("3 days")
    })

    it("formats exactly 24 hours as 1 day (singular)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000) // exactly 24 hours
      expect(formatGranularTime(future)).toBe("1 day")
    })

    it("formats 25 hours as 1 day", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 25 * 60 * 60 * 1000) // 25 hours
      expect(formatGranularTime(future)).toBe("1 day")
    })

    it("formats 48 hours as 2 days", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 48 * 60 * 60 * 1000) // 48 hours
      expect(formatGranularTime(future)).toBe("2 days")
    })
  })

  describe("future dates - hours", () => {
    it("formats 1-24 hours as hours", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 5 * 60 * 60 * 1000) // 5 hours
      expect(formatGranularTime(future)).toBe("5 hours")
    })

    it("formats exactly 1 hour (singular)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 1 * 60 * 60 * 1000) // exactly 1 hour
      expect(formatGranularTime(future)).toBe("1 hour")
    })

    it("formats 23 hours as hours (not days)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 23 * 60 * 60 * 1000) // 23 hours
      expect(formatGranularTime(future)).toBe("23 hours")
    })

    it("formats 23.5 hours as 23 hours (not 1 day) - CRITICAL BUG TEST", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 23.5 * 60 * 60 * 1000) // 23 hours 30 minutes
      expect(formatGranularTime(future)).toBe("23 hours")
    })

    it("formats 23 hours 59 minutes as 23 hours (not 1 day)", () => {
      const now = new Date()
      const future = new Date(
        now.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000,
      ) // 23h 59m
      expect(formatGranularTime(future)).toBe("23 hours")
    })

    it("formats 90 minutes as 1 hour", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 90 * 60 * 1000) // 90 minutes
      expect(formatGranularTime(future)).toBe("1 hour")
    })
  })

  describe("future dates - minutes", () => {
    it("formats <1 hour as minutes", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 45 * 60 * 1000) // 45 minutes
      expect(formatGranularTime(future)).toBe("45 minutes")
    })

    it("formats exactly 1 minute (singular)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 1 * 60 * 1000) // exactly 1 minute
      expect(formatGranularTime(future)).toBe("1 minute")
    })

    it("formats 59 minutes as minutes (not hours)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 59 * 60 * 1000) // 59 minutes
      expect(formatGranularTime(future)).toBe("59 minutes")
    })

    it("formats 0 minutes as 'less than a minute'", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 30 * 1000) // 30 seconds
      expect(formatGranularTime(future)).toBe("less than a minute")
    })
  })

  describe("edge cases", () => {
    it("accepts string dates", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      const futureStr = future.toISOString()
      const result = formatGranularTime(futureStr)
      // Should be "2 days" or "1 day" depending on exact timing
      expect(result).toMatch(/^(1|2) days?$/)
    })

    it("handles exactly 0 time difference", () => {
      const now = new Date()
      expect(formatGranularTime(now)).toBe("less than a minute")
    })
  })

  describe("past dates (for 'ago' display)", () => {
    it("formats past dates with 'ago' suffix - days", () => {
      const now = new Date()
      const past = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      expect(formatGranularTime(past)).toBe("3 days ago")
    })

    it("formats past dates with 'ago' suffix - hours", () => {
      const now = new Date()
      const past = new Date(now.getTime() - 5 * 60 * 60 * 1000) // 5 hours ago
      expect(formatGranularTime(past)).toBe("5 hours ago")
    })

    it("formats past dates with 'ago' suffix - minutes", () => {
      const now = new Date()
      const past = new Date(now.getTime() - 45 * 60 * 1000) // 45 minutes ago
      expect(formatGranularTime(past)).toBe("45 minutes ago")
    })
  })

  describe("DST edge cases - regression tests", () => {
    it("correctly handles dates created with millisecond arithmetic (24 hours exactly)", () => {
      const now = new Date()
      const future = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
      expect(formatGranularTime(future)).toBe("1 day")
    })

    it("correctly handles dates very close to 24 hours (23h 59m)", () => {
      const now = new Date()
      const future = new Date(
        now.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000,
      )
      expect(formatGranularTime(future)).toBe("23 hours")
    })

    it("correctly formats times in the 23-24 hour boundary range", () => {
      const testCases = [
        { hours: 22.5, expected: "22 hours" },
        { hours: 23, expected: "23 hours" },
        { hours: 23.5, expected: "23 hours" },
        { hours: 23.9, expected: "23 hours" },
        { hours: 24, expected: "1 day" },
        { hours: 24.1, expected: "1 day" },
      ]

      testCases.forEach(({ hours, expected }) => {
        const now = new Date()
        const future = new Date(now.getTime() + hours * 60 * 60 * 1000)
        expect(formatGranularTime(future)).toBe(expected)
      })
    })
  })
})
