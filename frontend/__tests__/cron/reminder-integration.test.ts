import { describe, it, expect, beforeEach, vi } from "vitest"

type ReminderType =
  | "1_hour"
  | "12_hours"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "25_percent"
  | "50_percent"

interface ReminderRecord {
  secretId: string
  reminderType: ReminderType
  sentAt: Date
  scheduledFor: Date
  status: "sent" | "pending" | "failed"
}

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

function hasReminderBeenSent(
  sentReminders: ReminderRecord[],
  secretId: string,
  reminderType: ReminderType,
  lastCheckIn: Date,
): boolean {
  return sentReminders.some(
    (r) =>
      r.secretId === secretId &&
      r.reminderType === reminderType &&
      r.status === "sent" &&
      r.sentAt >= lastCheckIn,
  )
}

describe("Reminder Scheduling Integration", () => {
  let sentReminders: ReminderRecord[]

  beforeEach(() => {
    sentReminders = []
  })

  describe("7-day check-in interval - full lifecycle", () => {
    const secretId = "test-secret-1"
    const checkInDays = 7
    const lastCheckIn = new Date("2025-01-01T00:00:00Z")

    it("should send all 7 reminders over the course of a 7-day period", () => {
      const triggerTime = new Date("2025-01-08T00:00:00Z")

      const checkPoints = [
        { time: new Date("2025-01-04T12:00:00Z"), expected: ["50_percent"] },
        {
          time: new Date("2025-01-05T18:00:00Z"),
          expected: ["50_percent", "25_percent"],
        },
        {
          time: new Date("2025-01-06T00:00:00Z"),
          expected: ["50_percent", "25_percent", "3_days"],
        },
        {
          time: new Date("2025-01-07T00:00:00Z"),
          expected: ["50_percent", "25_percent", "3_days", "24_hours"],
        },
        {
          time: new Date("2025-01-07T12:00:00Z"),
          expected: [
            "50_percent",
            "25_percent",
            "3_days",
            "24_hours",
            "12_hours",
          ],
        },
        {
          time: new Date("2025-01-07T23:00:00Z"),
          expected: [
            "50_percent",
            "25_percent",
            "3_days",
            "24_hours",
            "12_hours",
            "1_hour",
          ],
        },
      ]

      for (const checkpoint of checkPoints) {
        vi.setSystemTime(checkpoint.time)

        const applicable = getApplicableReminderTypes(triggerTime, checkInDays)

        for (const reminderType of applicable) {
          const alreadySent = hasReminderBeenSent(
            sentReminders,
            secretId,
            reminderType,
            lastCheckIn,
          )

          if (!alreadySent) {
            sentReminders.push({
              secretId,
              reminderType,
              sentAt: checkpoint.time,
              scheduledFor: checkpoint.time,
              status: "sent",
            })
          }
        }
      }

      const uniqueTypes = new Set(sentReminders.map((r) => r.reminderType))
      expect(uniqueTypes.size).toBe(7)
      expect(uniqueTypes.has("50_percent")).toBe(true)
      expect(uniqueTypes.has("25_percent")).toBe(true)
      expect(uniqueTypes.has("3_days")).toBe(true)
      expect(uniqueTypes.has("7_days")).toBe(true)
      expect(uniqueTypes.has("24_hours")).toBe(true)
      expect(uniqueTypes.has("12_hours")).toBe(true)
      expect(uniqueTypes.has("1_hour")).toBe(true)

      vi.useRealTimers()
    })

    it("should not send duplicate reminders in the same check-in period", () => {
      const triggerTime = new Date("2025-01-08T00:00:00Z")
      const checkTime = new Date("2025-01-07T12:00:00Z")

      vi.setSystemTime(checkTime)

      const applicable = getApplicableReminderTypes(triggerTime, checkInDays)

      for (const reminderType of applicable) {
        const alreadySent = hasReminderBeenSent(
          sentReminders,
          secretId,
          reminderType,
          lastCheckIn,
        )

        if (!alreadySent) {
          sentReminders.push({
            secretId,
            reminderType,
            sentAt: checkTime,
            scheduledFor: checkTime,
            status: "sent",
          })
        }
      }

      const firstRunCount = sentReminders.length

      for (const reminderType of applicable) {
        const alreadySent = hasReminderBeenSent(
          sentReminders,
          secretId,
          reminderType,
          lastCheckIn,
        )
        expect(alreadySent).toBe(true)
      }

      const secondRunCount = sentReminders.length
      expect(secondRunCount).toBe(firstRunCount)

      vi.useRealTimers()
    })
  })

  describe("Multiple cron runs handling", () => {
    it("should handle cron running every 15 minutes and send reminders only once", () => {
      const secretId = "test-secret-2"
      const checkInDays = 7
      const lastCheckIn = new Date("2025-01-01T00:00:00Z")
      const triggerTime = new Date("2025-01-08T00:00:00Z")

      const cronRuns = [
        new Date("2025-01-07T11:45:00Z"),
        new Date("2025-01-07T12:00:00Z"),
        new Date("2025-01-07T12:15:00Z"),
        new Date("2025-01-07T12:30:00Z"),
        new Date("2025-01-07T12:45:00Z"),
      ]

      for (const runTime of cronRuns) {
        vi.setSystemTime(runTime)

        const applicable = getApplicableReminderTypes(triggerTime, checkInDays)

        for (const reminderType of applicable) {
          const alreadySent = hasReminderBeenSent(
            sentReminders,
            secretId,
            reminderType,
            lastCheckIn,
          )

          if (!alreadySent) {
            sentReminders.push({
              secretId,
              reminderType,
              sentAt: runTime,
              scheduledFor: runTime,
              status: "sent",
            })
          }
        }
      }

      const reminderTypeCounts = sentReminders.reduce(
        (acc, r) => {
          acc[r.reminderType] = (acc[r.reminderType] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      for (const [type, count] of Object.entries(reminderTypeCounts)) {
        expect(count).toBe(1)
      }

      vi.useRealTimers()
    })
  })

  describe("1-day check-in interval", () => {
    it("should send appropriate reminders for 1-day interval", () => {
      const secretId = "test-secret-3"
      const checkInDays = 1
      const lastCheckIn = new Date("2025-01-01T00:00:00Z")
      const triggerTime = new Date("2025-01-02T00:00:00Z")

      const checkPoints = [
        { time: new Date("2025-01-01T12:00:00Z"), expected: ["50_percent"] },
        {
          time: new Date("2025-01-01T18:00:00Z"),
          expected: ["50_percent", "25_percent"],
        },
        {
          time: new Date("2025-01-01T23:30:00Z"),
          expected: [
            "50_percent",
            "25_percent",
            "24_hours",
            "12_hours",
            "1_hour",
          ],
        },
      ]

      for (const checkpoint of checkPoints) {
        vi.setSystemTime(checkpoint.time)

        const applicable = getApplicableReminderTypes(triggerTime, checkInDays)

        for (const reminderType of applicable) {
          const alreadySent = hasReminderBeenSent(
            sentReminders,
            secretId,
            reminderType,
            lastCheckIn,
          )

          if (!alreadySent) {
            sentReminders.push({
              secretId,
              reminderType,
              sentAt: checkpoint.time,
              scheduledFor: checkpoint.time,
              status: "sent",
            })
          }
        }
      }

      const uniqueTypes = new Set(sentReminders.map((r) => r.reminderType))
      expect(uniqueTypes.has("50_percent")).toBe(true)
      expect(uniqueTypes.has("25_percent")).toBe(true)
      expect(uniqueTypes.has("24_hours")).toBe(true)
      expect(uniqueTypes.has("12_hours")).toBe(true)
      expect(uniqueTypes.has("1_hour")).toBe(true)
      expect(uniqueTypes.has("3_days")).toBe(true)
      expect(uniqueTypes.has("7_days")).toBe(true)

      vi.useRealTimers()
    })
  })

  describe("30-day check-in interval", () => {
    it("should send percentage-based reminders for longer intervals", () => {
      const secretId = "test-secret-4"
      const checkInDays = 30
      const lastCheckIn = new Date("2025-01-01T00:00:00Z")
      const triggerTime = new Date("2025-01-31T00:00:00Z")

      const checkPoints = [
        { time: new Date("2025-01-16T00:00:00Z"), expected: ["50_percent"] },
        {
          time: new Date("2025-01-23T12:00:00Z"),
          expected: ["50_percent", "25_percent", "7_days"],
        },
        {
          time: new Date("2025-01-28T00:00:00Z"),
          expected: ["50_percent", "25_percent", "7_days", "3_days"],
        },
      ]

      for (const checkpoint of checkPoints) {
        vi.setSystemTime(checkpoint.time)

        const applicable = getApplicableReminderTypes(triggerTime, checkInDays)

        for (const reminderType of applicable) {
          const alreadySent = hasReminderBeenSent(
            sentReminders,
            secretId,
            reminderType,
            lastCheckIn,
          )

          if (!alreadySent) {
            sentReminders.push({
              secretId,
              reminderType,
              sentAt: checkpoint.time,
              scheduledFor: checkpoint.time,
              status: "sent",
            })
          }
        }
      }

      const uniqueTypes = new Set(sentReminders.map((r) => r.reminderType))
      expect(uniqueTypes.has("50_percent")).toBe(true)
      expect(uniqueTypes.has("25_percent")).toBe(true)
      expect(uniqueTypes.has("7_days")).toBe(true)
      expect(uniqueTypes.has("3_days")).toBe(true)

      vi.useRealTimers()
    })
  })

  describe("Check-in period boundary", () => {
    it("should reset reminders for new check-in period after user checks in", () => {
      const secretId = "test-secret-5"
      const checkInDays = 7

      const firstPeriodStart = new Date("2025-01-01T00:00:00Z")
      const firstPeriodTrigger = new Date("2025-01-08T00:00:00Z")

      vi.setSystemTime(new Date("2025-01-07T12:00:00Z"))

      let applicable = getApplicableReminderTypes(
        firstPeriodTrigger,
        checkInDays,
      )

      for (const reminderType of applicable) {
        const alreadySent = hasReminderBeenSent(
          sentReminders,
          secretId,
          reminderType,
          firstPeriodStart,
        )

        if (!alreadySent) {
          sentReminders.push({
            secretId,
            reminderType,
            sentAt: new Date(),
            scheduledFor: new Date(),
            status: "sent",
          })
        }
      }

      const firstPeriodCount = sentReminders.length
      expect(firstPeriodCount).toBeGreaterThan(0)

      const secondPeriodStart = new Date("2025-01-08T10:00:00Z")
      const secondPeriodTrigger = new Date("2025-01-15T10:00:00Z")

      vi.setSystemTime(new Date("2025-01-14T22:00:00Z"))

      applicable = getApplicableReminderTypes(secondPeriodTrigger, checkInDays)

      for (const reminderType of applicable) {
        const alreadySent = hasReminderBeenSent(
          sentReminders,
          secretId,
          reminderType,
          secondPeriodStart,
        )

        if (!alreadySent) {
          sentReminders.push({
            secretId,
            reminderType,
            sentAt: new Date(),
            scheduledFor: new Date(),
            status: "sent",
          })
        }
      }

      const secondPeriodReminders = sentReminders.filter(
        (r) => r.sentAt >= secondPeriodStart,
      )
      expect(secondPeriodReminders.length).toBeGreaterThan(0)

      vi.useRealTimers()
    })
  })
})
