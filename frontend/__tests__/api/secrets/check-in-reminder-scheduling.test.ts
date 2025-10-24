import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

vi.unmock("@/lib/db/drizzle")

import { getDatabase } from "@/lib/db/drizzle"
import {
  secrets,
  reminderJobs,
  users,
  secretRecipients,
  checkinHistory,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { scheduleRemindersForSecret } from "@/lib/services/reminder-scheduler"

describe("Check-In Endpoint - Reminder Rescheduling Integration", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>
  let testUserId: string
  let testSecretId: string

  beforeEach(async () => {
    db = await getDatabase()

    testUserId = `test-user-${Date.now()}-${Math.random()}`

    await db.insert(users).values({
      id: testUserId,
      email: `test-checkin-${Date.now()}-${Math.random()}@example.com`,
      name: "Test User",
      emailVerified: new Date(),
    })
  })

  afterEach(async () => {
    if (testSecretId) {
      await db
        .delete(checkinHistory)
        .where(eq(checkinHistory.secretId, testSecretId))
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

  it("should reschedule reminders when user checks in", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 30
    const initialNextCheckIn = new Date(
      createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Check-In",
        checkInDays: checkInDays,
        nextCheckIn: initialNextCheckIn,
        lastCheckIn: createdAt,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    await scheduleRemindersForSecret(secret.id, initialNextCheckIn, checkInDays)

    const initialReminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(initialReminders).toHaveLength(7)

    const checkInTime = new Date("2025-11-15T10:00:00.000Z")
    vi.setSystemTime(checkInTime)

    const newNextCheckIn = new Date(
      checkInTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    await db
      .update(secrets)
      .set({
        lastCheckIn: checkInTime,
        nextCheckIn: newNextCheckIn,
      })
      .where(eq(secrets.id, secret.id))

    const result = await scheduleRemindersForSecret(
      secret.id,
      newNextCheckIn,
      checkInDays,
    )

    expect(result.scheduled).toBe(7)
    expect(result.invalidated).toBeGreaterThan(0)

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

    vi.useRealTimers()
  })

  it("should invalidate all old reminders when checking in multiple times", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 7

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Multiple Check-Ins",
        checkInDays: checkInDays,
        nextCheckIn: new Date(
          createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
        ),
        lastCheckIn: createdAt,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    const firstCheckIn = new Date("2025-11-01T12:00:00.000Z")
    vi.setSystemTime(firstCheckIn)
    const firstNextCheckIn = new Date(
      firstCheckIn.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, firstNextCheckIn, checkInDays)

    const secondCheckIn = new Date("2025-11-04T15:00:00.000Z")
    vi.setSystemTime(secondCheckIn)
    const secondNextCheckIn = new Date(
      secondCheckIn.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, secondNextCheckIn, checkInDays)

    const thirdCheckIn = new Date("2025-11-07T09:00:00.000Z")
    vi.setSystemTime(thirdCheckIn)
    const thirdNextCheckIn = new Date(
      thirdCheckIn.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, thirdNextCheckIn, checkInDays)

    const allReminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    const pendingReminders = allReminders.filter((r) => r.status === "pending")
    const cancelledReminders = allReminders.filter(
      (r) => r.status === "cancelled",
    )

    expect(pendingReminders.length).toBeGreaterThan(0)
    expect(cancelledReminders.length).toBeGreaterThan(0)

    for (const reminder of pendingReminders) {
      expect(reminder.scheduledFor.getTime()).toBeGreaterThan(
        thirdCheckIn.getTime(),
      )
      expect(reminder.scheduledFor.getTime()).toBeLessThan(
        thirdNextCheckIn.getTime(),
      )
    }

    vi.useRealTimers()
  })

  it("should handle check-in very close to next_check_in deadline", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 30
    const initialNextCheckIn = new Date(
      createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Late Check-In",
        checkInDays: checkInDays,
        nextCheckIn: initialNextCheckIn,
        lastCheckIn: createdAt,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    await scheduleRemindersForSecret(secret.id, initialNextCheckIn, checkInDays)

    const lateCheckInTime = new Date(
      initialNextCheckIn.getTime() - 30 * 60 * 1000,
    )
    vi.setSystemTime(lateCheckInTime)

    const newNextCheckIn = new Date(
      lateCheckInTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    const result = await scheduleRemindersForSecret(
      secret.id,
      newNextCheckIn,
      checkInDays,
    )

    expect(result.scheduled).toBe(7)

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

    vi.useRealTimers()
  })

  it("should preserve reminder history after check-in", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 30

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Reminder History",
        checkInDays: checkInDays,
        nextCheckIn: new Date(
          createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
        ),
        lastCheckIn: createdAt,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "active",
      })
      .returning()

    testSecretId = secret.id

    const firstNextCheckIn = new Date(
      createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, firstNextCheckIn, checkInDays)

    const initialReminderIds = (
      await db
        .select({ id: reminderJobs.id })
        .from(reminderJobs)
        .where(eq(reminderJobs.secretId, secret.id))
    ).map((r) => r.id)

    const checkInTime = new Date("2025-11-15T10:00:00.000Z")
    vi.setSystemTime(checkInTime)

    const newNextCheckIn = new Date(
      checkInTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, newNextCheckIn, checkInDays)

    const allReminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    const oldReminders = allReminders.filter((r) =>
      initialReminderIds.includes(r.id),
    )
    for (const reminder of oldReminders) {
      expect(reminder.status).toBe("cancelled")
    }

    const newReminders = allReminders.filter(
      (r) => !initialReminderIds.includes(r.id),
    )
    for (const reminder of newReminders) {
      expect(reminder.status).toBe("pending")
    }

    vi.useRealTimers()
  })
})
