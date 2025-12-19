import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

vi.unmock("@/lib/db/drizzle")

import { getDatabase } from "@/lib/db/drizzle"
import { secrets, reminderJobs, users, secretRecipients } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { scheduleRemindersForSecret } from "@/lib/services/reminder-scheduler"

// Skip these integration tests in CI/unit test runs - they require a real database
const shouldSkip = !process.env.RUN_INTEGRATION_TESTS

describe.skipIf(shouldSkip)("Secret Creation - Reminder Scheduling Integration", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>
  let testUserId: string
  let testSecretId: string

  beforeEach(async () => {
    db = await getDatabase()

    testUserId = `test-user-${Date.now()}`

    await db.insert(users).values({
      id: testUserId,
      email: `test-reminder-${Date.now()}@example.com`,
      name: "Test User",
      emailVerified: new Date(),
    })
  })

  afterEach(async () => {
    if (testSecretId) {
      await db
        .delete(reminderJobs)
        .where(eq(reminderJobs.secretId, testSecretId))
      await db
        .delete(secretRecipients)
        .where(eq(secretRecipients.secretId, testSecretId))
      await db.delete(secrets).where(eq(secrets.id, testSecretId))
    }

    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

  it("should schedule all 7 reminders when creating a 30-day secret", async () => {
    const now = new Date()
    const checkInDays = 30
    const nextCheckIn = new Date(
      now.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret",
        checkInDays: checkInDays,
        nextCheckIn: nextCheckIn,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    const result = await scheduleRemindersForSecret(
      secret.id,
      nextCheckIn,
      checkInDays,
    )

    expect(result.scheduled).toBe(7)
    expect(result.invalidated).toBe(0)

    const reminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(reminders).toHaveLength(7)

    const reminderTypes = reminders.map((r) => r.reminderType).sort()
    expect(reminderTypes).toEqual([
      "12_hours",
      "1_hour",
      "24_hours",
      "25_percent",
      "3_days",
      "50_percent",
      "7_days",
    ])

    for (const reminder of reminders) {
      expect(reminder.status).toBe("pending")
      expect(reminder.scheduledFor.getTime()).toBeGreaterThan(now.getTime())
      expect(reminder.scheduledFor.getTime()).toBeLessThan(
        nextCheckIn.getTime(),
      )
    }
  })

  it("should schedule only applicable reminders for 1-day secret", async () => {
    const now = new Date()
    const checkInDays = 1
    const nextCheckIn = new Date(
      now.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret 1 Day",
        checkInDays: checkInDays,
        nextCheckIn: nextCheckIn,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    const result = await scheduleRemindersForSecret(
      secret.id,
      nextCheckIn,
      checkInDays,
    )

    expect(result.scheduled).toBeGreaterThan(0)
    expect(result.scheduled).toBeLessThan(7)

    const reminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    const reminderTypes = reminders.map((r) => r.reminderType)

    expect(reminderTypes).toContain("1_hour")
    expect(reminderTypes).toContain("12_hours")
    expect(reminderTypes).toContain("25_percent")
    // 50_percent is same as 12_hours for 1-day secret, so may not be scheduled separately

    expect(reminderTypes).not.toContain("7_days")
    expect(reminderTypes).not.toContain("3_days")
    expect(reminderTypes).not.toContain("24_hours")
  })

  it("should schedule only applicable reminders for 7-day secret", async () => {
    const now = new Date()
    const checkInDays = 7
    const nextCheckIn = new Date(
      now.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret 7 Days",
        checkInDays: checkInDays,
        nextCheckIn: nextCheckIn,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    await scheduleRemindersForSecret(secret.id, nextCheckIn, checkInDays)

    const reminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    const reminderTypes = reminders.map((r) => r.reminderType)

    expect(reminderTypes).toContain("1_hour")
    expect(reminderTypes).toContain("12_hours")
    expect(reminderTypes).toContain("24_hours")
    expect(reminderTypes).toContain("3_days")
    expect(reminderTypes).toContain("25_percent")
    expect(reminderTypes).toContain("50_percent")

    expect(reminderTypes).not.toContain("7_days")
  })

  it("should invalidate old reminders and schedule new ones on check-in", async () => {
    const now = new Date()
    const checkInDays = 30
    const initialNextCheckIn = new Date(
      now.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Reschedule",
        checkInDays: checkInDays,
        nextCheckIn: initialNextCheckIn,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    const firstSchedule = await scheduleRemindersForSecret(
      secret.id,
      initialNextCheckIn,
      checkInDays,
    )

    expect(firstSchedule.scheduled).toBe(7)

    const checkInTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    const newNextCheckIn = new Date(
      checkInTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    vi.useFakeTimers()
    vi.setSystemTime(checkInTime)

    const secondSchedule = await scheduleRemindersForSecret(
      secret.id,
      newNextCheckIn,
      checkInDays,
    )

    vi.useRealTimers()

    expect(secondSchedule.scheduled).toBe(7)
    expect(secondSchedule.invalidated).toBeGreaterThan(0)

    const pendingReminders = await db
      .select()
      .from(reminderJobs)
      .where(
        and(
          eq(reminderJobs.secretId, secret.id),
          eq(reminderJobs.status, "pending"),
        ),
      )

    expect(pendingReminders).toHaveLength(7)

    for (const reminder of pendingReminders) {
      expect(reminder.scheduledFor.getTime()).toBeGreaterThan(
        checkInTime.getTime(),
      )
      expect(reminder.scheduledFor.getTime()).toBeLessThan(
        newNextCheckIn.getTime(),
      )
    }

    const cancelledReminders = await db
      .select()
      .from(reminderJobs)
      .where(
        and(
          eq(reminderJobs.secretId, secret.id),
          eq(reminderJobs.status, "cancelled"),
        ),
      )

    expect(cancelledReminders.length).toBeGreaterThan(0)
  })

  it("should not schedule reminders for past dates", async () => {
    const now = new Date()
    const checkInDays = 30
    const pastNextCheckIn = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Past",
        checkInDays: checkInDays,
        nextCheckIn: pastNextCheckIn,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    const result = await scheduleRemindersForSecret(
      secret.id,
      pastNextCheckIn,
      checkInDays,
    )

    expect(result.scheduled).toBe(0)

    const reminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(reminders).toHaveLength(0)
  })

  it("should calculate correct scheduled times for each reminder type", async () => {
    const now = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 30
    const nextCheckIn = new Date("2025-11-28T20:25:52.000Z")

    vi.useFakeTimers()
    vi.setSystemTime(now)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Timing",
        checkInDays: checkInDays,
        nextCheckIn: nextCheckIn,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    await scheduleRemindersForSecret(secret.id, nextCheckIn, checkInDays)

    const reminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    const reminderMap = Object.fromEntries(
      reminders.map((r) => [r.reminderType, r.scheduledFor]),
    )

    expect(reminderMap["50_percent"]?.toISOString()).toBe(
      "2025-11-13T20:25:52.000Z",
    )
    expect(reminderMap["25_percent"]?.toISOString()).toBe(
      "2025-11-21T08:25:52.000Z",
    )
    expect(reminderMap["7_days"]?.toISOString()).toBe(
      "2025-11-21T20:25:52.000Z",
    )
    expect(reminderMap["3_days"]?.toISOString()).toBe(
      "2025-11-25T20:25:52.000Z",
    )
    expect(reminderMap["24_hours"]?.toISOString()).toBe(
      "2025-11-27T20:25:52.000Z",
    )
    expect(reminderMap["12_hours"]?.toISOString()).toBe(
      "2025-11-28T08:25:52.000Z",
    )
    expect(reminderMap["1_hour"]?.toISOString()).toBe(
      "2025-11-28T19:25:52.000Z",
    )

    vi.useRealTimers()
  })
})
