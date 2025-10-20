import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getAllReminderTypes,
  calculateScheduledFor,
  getApplicableReminderTypes,
  type ReminderType,
} from "@/lib/services/reminder-scheduler"

describe("reminder-scheduler", () => {
  describe("getAllReminderTypes", () => {
    it("should return all 7 reminder types in order", () => {
      const types = getAllReminderTypes()
      expect(types).toEqual([
        "50_percent",
        "25_percent",
        "7_days",
        "3_days",
        "24_hours",
        "12_hours",
        "1_hour",
      ])
    })
  })

  describe("calculateScheduledFor", () => {
    it("should calculate 1_hour reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("1_hour", nextCheckIn, 30)
      expect(scheduledFor).toEqual(new Date("2025-10-30T11:00:00Z"))
    })

    it("should calculate 12_hours reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("12_hours", nextCheckIn, 30)
      expect(scheduledFor).toEqual(new Date("2025-10-30T00:00:00Z"))
    })

    it("should calculate 24_hours reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("24_hours", nextCheckIn, 30)
      expect(scheduledFor).toEqual(new Date("2025-10-29T12:00:00Z"))
    })

    it("should calculate 3_days reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("3_days", nextCheckIn, 30)
      expect(scheduledFor).toEqual(new Date("2025-10-27T12:00:00Z"))
    })

    it("should calculate 7_days reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("7_days", nextCheckIn, 30)
      expect(scheduledFor).toEqual(new Date("2025-10-23T12:00:00Z"))
    })

    it("should calculate 25_percent reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("25_percent", nextCheckIn, 30)
      const expectedDate = new Date(
        nextCheckIn.getTime() - 30 * 24 * 60 * 60 * 1000 * 0.75,
      )
      expect(scheduledFor).toEqual(expectedDate)
    })

    it("should calculate 50_percent reminder correctly", () => {
      const nextCheckIn = new Date("2025-10-30T12:00:00Z")
      const scheduledFor = calculateScheduledFor("50_percent", nextCheckIn, 30)
      const expectedDate = new Date(
        nextCheckIn.getTime() - 30 * 24 * 60 * 60 * 1000 * 0.5,
      )
      expect(scheduledFor).toEqual(expectedDate)
    })
  })

  describe("getApplicableReminderTypes", () => {
    it("should return all reminders for 30-day interval", () => {
      const now = new Date("2025-10-01T00:00:00Z")
      const nextCheckIn = new Date("2025-10-31T00:00:00Z")
      const checkInDays = 30

      vi.useFakeTimers()
      vi.setSystemTime(now)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("1_hour")
      expect(types).toContain("12_hours")
      expect(types).toContain("24_hours")
      expect(types).toContain("3_days")
      expect(types).toContain("7_days")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")

      vi.useRealTimers()
    })

    it("should return only short-term reminders for 1-day interval", () => {
      const now = new Date("2025-10-01T00:00:00Z")
      const nextCheckIn = new Date("2025-10-02T00:00:00Z")
      const checkInDays = 1

      vi.useFakeTimers()
      vi.setSystemTime(now)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("1_hour")
      expect(types).toContain("12_hours")
      expect(types).toContain("25_percent")
      expect(types).toContain("50_percent")
      expect(types).not.toContain("3_days")
      expect(types).not.toContain("7_days")

      vi.useRealTimers()
    })

    it("should return empty array for past check-in", () => {
      const now = new Date("2025-10-31T00:00:00Z")
      const nextCheckIn = new Date("2025-10-01T00:00:00Z")
      const checkInDays = 30

      vi.useFakeTimers()
      vi.setSystemTime(now)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toEqual([])

      vi.useRealTimers()
    })

    it("should exclude 7_days reminder for 5-day interval", () => {
      const now = new Date("2025-10-01T00:00:00Z")
      const nextCheckIn = new Date("2025-10-06T00:00:00Z")
      const checkInDays = 5

      vi.useFakeTimers()
      vi.setSystemTime(now)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)

      expect(types).toContain("3_days")
      expect(types).not.toContain("7_days")

      vi.useRealTimers()
    })
  })

  describe("reminder scheduling scenarios", () => {
    it("should schedule reminders for your specific test case", () => {
      const createdAt = new Date("2025-10-29T20:25:52Z")
      const checkInDays = 30
      const nextCheckIn = new Date(
        createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
      )

      vi.useFakeTimers()
      vi.setSystemTime(createdAt)

      const types = getApplicableReminderTypes(nextCheckIn, checkInDays)
      const reminders: Record<ReminderType, Date> = {} as any

      for (const type of types) {
        reminders[type] = calculateScheduledFor(type, nextCheckIn, checkInDays)
      }

      expect(reminders["50_percent"]).toEqual(
        new Date(createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000 * 0.5),
      )
      expect(reminders["25_percent"]).toEqual(
        new Date(
          createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000 * 0.25,
        ),
      )
      expect(reminders["7_days"]).toEqual(
        new Date(nextCheckIn.getTime() - 7 * 24 * 60 * 60 * 1000),
      )
      expect(reminders["3_days"]).toEqual(
        new Date(nextCheckIn.getTime() - 3 * 24 * 60 * 60 * 1000),
      )
      expect(reminders["24_hours"]).toEqual(
        new Date(nextCheckIn.getTime() - 24 * 60 * 60 * 1000),
      )
      expect(reminders["12_hours"]).toEqual(
        new Date(nextCheckIn.getTime() - 12 * 60 * 60 * 1000),
      )
      expect(reminders["1_hour"]).toEqual(
        new Date(nextCheckIn.getTime() - 1 * 60 * 60 * 1000),
      )

      vi.useRealTimers()
    })
  })
})
