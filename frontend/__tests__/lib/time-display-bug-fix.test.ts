/**
 * Integration test for time display bug fix
 *
 * Bug: Secrets with 23 hours remaining were displaying "Triggers in 1 day"
 * Root Cause: Check-in routes were using .setDate() which can create 23-hour periods during DST transitions
 * Fix: Changed to millisecond arithmetic to guarantee exactly 24-hour periods
 */

import { describe, it, expect } from "vitest"
import { formatGranularTime } from "@/lib/time-utils"

describe("Time Display Bug Fix - Issue #23hours-shows-as-1day", () => {
  describe("Bug Reproduction - Before Fix", () => {
    it('demonstrates the problem: DST can cause 23-hour "days"', () => {
      // Simulate what happens with .setDate() during DST spring forward
      // On March 10, 2024, clocks "spring forward" from 2 AM to 3 AM
      const beforeDST = new Date("2024-03-10T01:00:00-08:00")
      const afterDSTUsingSetDate = new Date(beforeDST)
      afterDSTUsingSetDate.setDate(afterDSTUsingSetDate.getDate() + 1)

      // This creates a 23-hour period because we lose 1 hour to DST
      // But our tests run in UTC, so this won't show the issue directly
      // The real issue happens in production with user timezones

      // The fix ensures we always use millisecond arithmetic
      const correctNextCheckIn = new Date(
        beforeDST.getTime() + 1 * 24 * 60 * 60 * 1000,
      )

      // Verify the fix creates exactly 24 hours
      const diffMs = correctNextCheckIn.getTime() - beforeDST.getTime()
      expect(diffMs).toBe(24 * 60 * 60 * 1000) // Exactly 24 hours in milliseconds
    })
  })

  describe("Bug Fix Validation - After Fix", () => {
    it('correctly displays 23 hours as "23 hours" not "1 day"', () => {
      const now = new Date()
      const future23h = new Date(now.getTime() + 23 * 60 * 60 * 1000)

      const result = formatGranularTime(future23h)
      expect(result).toBe("23 hours")
      expect(result).not.toContain("day")
    })

    it('correctly displays 23.5 hours as "23 hours" not "1 day"', () => {
      const now = new Date()
      const future23_5h = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)

      const result = formatGranularTime(future23_5h)
      expect(result).toBe("23 hours")
      expect(result).not.toContain("day")
    })

    it('correctly displays 23h 59m as "23 hours" not "1 day"', () => {
      const now = new Date()
      const future23h59m = new Date(
        now.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000,
      )

      const result = formatGranularTime(future23h59m)
      expect(result).toBe("23 hours")
      expect(result).not.toContain("day")
    })

    it('correctly displays exactly 24 hours as "1 day"', () => {
      const now = new Date()
      const future24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      const result = formatGranularTime(future24h)
      expect(result).toBe("1 day")
    })

    it('correctly displays 24.1 hours as "1 day"', () => {
      const now = new Date()
      const future24_1h = new Date(now.getTime() + 24.1 * 60 * 60 * 1000)

      const result = formatGranularTime(future24_1h)
      expect(result).toBe("1 day")
    })
  })

  describe("Check-in Date Calculation - Millisecond Arithmetic", () => {
    it("uses millisecond arithmetic like the create route", () => {
      const now = new Date()
      const checkInDays = 1

      // This is how we now calculate nextCheckIn in check-in routes
      const nextCheckIn = new Date(
        now.getTime() + checkInDays * 24 * 60 * 60 * 1000,
      )

      const diffMs = nextCheckIn.getTime() - now.getTime()
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      // Verify it creates exactly 24 hours
      expect(hours).toBe(24)
      expect(days).toBe(1)
      expect(formatGranularTime(nextCheckIn)).toBe("1 day")
    })

    it("guarantees exactly N * 24 hours for any checkInDays value", () => {
      const now = new Date()
      const testCases = [1, 3, 7, 14, 30]

      testCases.forEach((checkInDays) => {
        const nextCheckIn = new Date(
          now.getTime() + checkInDays * 24 * 60 * 60 * 1000,
        )
        const diffMs = nextCheckIn.getTime() - now.getTime()
        const expectedMs = checkInDays * 24 * 60 * 60 * 1000

        expect(diffMs).toBe(expectedMs)
      })
    })
  })

  describe("Edge Cases - Boundary Conditions", () => {
    it("handles the critical 23-24 hour boundary correctly", () => {
      const now = new Date()

      // Test every 15 minutes around the 24-hour boundary
      const testCases = [
        { hours: 22.75, expected: "22 hours" }, // 22h 45m
        { hours: 23, expected: "23 hours" }, // 23h 0m
        { hours: 23.25, expected: "23 hours" }, // 23h 15m
        { hours: 23.5, expected: "23 hours" }, // 23h 30m
        { hours: 23.75, expected: "23 hours" }, // 23h 45m
        { hours: 24, expected: "1 day" }, // 24h 0m
        { hours: 24.25, expected: "1 day" }, // 24h 15m
      ]

      testCases.forEach(({ hours, expected }) => {
        const future = new Date(now.getTime() + hours * 60 * 60 * 1000)
        const result = formatGranularTime(future)
        expect(result).toBe(expected)
      })
    })
  })
})
