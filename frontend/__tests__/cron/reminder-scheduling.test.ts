import { describe, it, expect } from "vitest"

type ReminderType =
  | "1_hour"
  | "12_hours"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "25_percent"
  | "50_percent"

function getApplicableReminderTypes(
  nextCheckIn: Date,
  checkInDays: number,
): ReminderType[] {
  const now = new Date()
  const msRemaining = nextCheckIn.getTime() - now.getTime()

  if (msRemaining <= 0) {
    return []
  }

  const hoursRemaining = msRemaining / (1000 * 60 * 60)
  const daysRemaining = hoursRemaining / 24
  const totalHours = checkInDays * 24
  const percentRemaining = (hoursRemaining / totalHours) * 100

  const applicableTypes: ReminderType[] = []

  if (hoursRemaining <= 1) {
    applicableTypes.push("1_hour")
  }

  if (hoursRemaining <= 12) {
    applicableTypes.push("12_hours")
  }

  if (hoursRemaining <= 24) {
    applicableTypes.push("24_hours")
  }

  if (daysRemaining <= 3) {
    applicableTypes.push("3_days")
  }

  if (daysRemaining <= 7) {
    applicableTypes.push("7_days")
  }

  if (percentRemaining <= 25) {
    applicableTypes.push("25_percent")
  }

  if (percentRemaining <= 50) {
    applicableTypes.push("50_percent")
  }

  return applicableTypes
}

describe("getApplicableReminderTypes", () => {
  describe("7-day check-in interval", () => {
    const checkInDays = 7

    it("should return all 7 reminder types when 30 minutes remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("1_hour")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toHaveLength(7)
    })

    it("should return 6 types when 2 hours remaining (not 1_hour)", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 2 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).not.toContain("1_hour")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toHaveLength(6)
    })

    it("should return 5 types when 18 hours remaining (not 1h, 12h)", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 18 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).not.toContain("1_hour")
      expect(types).not.toContain("12_hours")
      expect(types).toContain("24_hours")
      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toHaveLength(5)
    })

    it("should include 25_percent and 50_percent when 1.5 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
      expect(types).toHaveLength(4)
    })

    it("should include 50_percent but not 25_percent when 3.5 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).not.toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toContain("7_days")
      expect(types).toHaveLength(2)
    })

    it("should return empty array when more than 7 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toHaveLength(0)
    })

    it("should return empty array when check-in is expired", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() - 1 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toHaveLength(0)
    })
  })

  describe("1-day check-in interval", () => {
    const checkInDays = 1

    it("should return all 7 types when 30 minutes remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toHaveLength(7)
      expect(types).toContain("1_hour")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
    })

    it("should include 25_percent when 6 hours remaining (25% of 24h)", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 6 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
    })

    it("should include 50_percent but not 25_percent when 12 hours remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 12 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).not.toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
    })

    it("should include 3_days and 7_days even for 1-day interval when time remaining is less than those thresholds", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 6 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
    })
  })

  describe("30-day check-in interval", () => {
    const checkInDays = 30

    it("should include all time-based reminders when 30 minutes remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("1_hour")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toHaveLength(7)
    })

    it("should include only 50_percent when 15 days remaining (50% of 30d)", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).not.toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).not.toContain("7_days")
      expect(types).toHaveLength(1)
    })

    it("should include only 25_percent and 50_percent when 7.5 days remaining (25% of 30d, not yet 7d)", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).not.toContain("7_days")
      expect(types).toHaveLength(2)
    })

    it("should return empty array when 31 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toHaveLength(0)
    })
  })

  describe("365-day (1 year) check-in interval", () => {
    const checkInDays = 365

    it("should include only 50_percent when 182.5 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 182.5 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).not.toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).not.toContain("7_days")
      expect(types).toHaveLength(1)
    })

    it("should include 25_percent and 50_percent when 91.25 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 91.25 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).not.toContain("7_days")
      expect(types).toHaveLength(2)
    })

    it("should include time-based reminders when 6 days remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).toContain("7_days")
      expect(types).not.toContain("3_days")
      expect(types).toHaveLength(3)
    })
  })

  describe("edge cases", () => {
    it("should handle exactly 1 hour remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 1 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, 7)

      expect(types).toContain("1_hour")
    })

    it("should handle exactly 12 hours remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 12 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, 7)

      expect(types).toContain("12_hours")
    })

    it("should handle exactly 50% remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, 7)

      expect(types).toContain("50_percent")
    })

    it("should handle exactly 25% remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 1.75 * 24 * 60 * 60 * 1000)

      const types = getApplicableReminderTypes(nextCheckIn, 7)

      expect(types).toContain("25_percent")
    })

    it("should handle 1 second remaining", () => {
      const now = new Date()
      const nextCheckIn = new Date(now.getTime() + 1000)

      const types = getApplicableReminderTypes(nextCheckIn, 7)

      expect(types).toHaveLength(7)
    })
  })
})
