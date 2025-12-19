import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

vi.unmock("@/lib/db/drizzle")

import { getDatabase } from "@/lib/db/drizzle"
import { secrets, reminderJobs, users, secretRecipients } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import {
  scheduleRemindersForSecret,
  cancelRemindersForSecret,
} from "@/lib/services/reminder-scheduler"

// Skip these integration tests in CI/unit test runs - they require a real database
const shouldSkip = !process.env.RUN_INTEGRATION_TESTS

describe.skipIf(shouldSkip)("Toggle Pause - Reminder Scheduling Integration", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>
  let testUserId: string
  let testSecretId: string

  beforeEach(async () => {
    db = await getDatabase()

    testUserId = `test-user-${Date.now()}-${Math.random()}`

    await db.insert(users).values({
      id: testUserId,
      email: `test-pause-${Date.now()}-${Math.random()}@example.com`,
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

  it("should schedule new reminders when unpausing a secret", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 30

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Paused",
        checkInDays: checkInDays,
        nextCheckIn: createdAt,
        lastCheckIn: createdAt,
        serverShare: "encrypted-share",
        iv: "test-iv",
        authTag: "test-auth-tag",
        sssSharesTotal: 3,
        sssThreshold: 2,
        status: "paused",
      })
      .returning()

    testSecretId = secret.id

    const remindersBeforeUnpause = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(remindersBeforeUnpause).toHaveLength(0)

    const unpauseTime = new Date("2025-11-05T14:30:00.000Z")
    vi.setSystemTime(unpauseTime)

    const newNextCheckIn = new Date(
      unpauseTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    await db
      .update(secrets)
      .set({
        status: "active",
        lastCheckIn: unpauseTime,
        nextCheckIn: newNextCheckIn,
      })
      .where(eq(secrets.id, secret.id))

    const result = await scheduleRemindersForSecret(
      secret.id,
      newNextCheckIn,
      checkInDays,
    )

    expect(result.scheduled).toBe(7)
    expect(result.invalidated).toBe(0)

    const remindersAfterUnpause = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(remindersAfterUnpause).toHaveLength(7)

    for (const reminder of remindersAfterUnpause) {
      expect(reminder.status).toBe("pending")
      expect(reminder.scheduledFor.getTime()).toBeGreaterThan(
        unpauseTime.getTime(),
      )
      expect(reminder.scheduledFor.getTime()).toBeLessThan(
        newNextCheckIn.getTime(),
      )
    }

    vi.useRealTimers()
  })

  it("should cancel reminders when pausing a secret", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 30
    const nextCheckIn = new Date(
      createdAt.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Active",
        checkInDays: checkInDays,
        nextCheckIn: nextCheckIn,
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

    await scheduleRemindersForSecret(secret.id, nextCheckIn, checkInDays)

    const remindersBeforePause = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(remindersBeforePause).toHaveLength(7)
    expect(remindersBeforePause.every((r) => r.status === "pending")).toBe(true)

    await db
      .update(secrets)
      .set({ status: "paused" })
      .where(eq(secrets.id, secret.id))

    const cancelledCount = await cancelRemindersForSecret(secret.id)

    expect(cancelledCount).toBe(7)

    const remindersAfterPause = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    expect(remindersAfterPause).toHaveLength(7)
    expect(remindersAfterPause.every((r) => r.status === "cancelled")).toBe(
      true,
    )

    vi.useRealTimers()
  })

  it("should invalidate old reminders and create new ones when unpausing after a long pause", async () => {
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
        title: "Test Secret Active Then Paused",
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

    const pauseTime = new Date("2025-11-01T10:00:00.000Z")
    vi.setSystemTime(pauseTime)

    await db
      .update(secrets)
      .set({ status: "paused" })
      .where(eq(secrets.id, secret.id))

    const unpauseTime = new Date("2025-12-15T14:00:00.000Z")
    vi.setSystemTime(unpauseTime)

    const newNextCheckIn = new Date(
      unpauseTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    await db
      .update(secrets)
      .set({
        status: "active",
        lastCheckIn: unpauseTime,
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
        unpauseTime.getTime(),
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

    vi.useRealTimers()
  })

  it("should handle pause/unpause cycles correctly", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 7

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Pause Cycles",
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

    await db
      .update(secrets)
      .set({ status: "paused" })
      .where(eq(secrets.id, secret.id))

    const firstUnpause = new Date("2025-11-01T12:00:00.000Z")
    vi.setSystemTime(firstUnpause)
    const firstUnpauseNextCheckIn = new Date(
      firstUnpause.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await db
      .update(secrets)
      .set({
        status: "active",
        lastCheckIn: firstUnpause,
        nextCheckIn: firstUnpauseNextCheckIn,
      })
      .where(eq(secrets.id, secret.id))
    await scheduleRemindersForSecret(
      secret.id,
      firstUnpauseNextCheckIn,
      checkInDays,
    )

    await db
      .update(secrets)
      .set({ status: "paused" })
      .where(eq(secrets.id, secret.id))

    const secondUnpause = new Date("2025-11-03T15:00:00.000Z")
    vi.setSystemTime(secondUnpause)
    const secondUnpauseNextCheckIn = new Date(
      secondUnpause.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await db
      .update(secrets)
      .set({
        status: "active",
        lastCheckIn: secondUnpause,
        nextCheckIn: secondUnpauseNextCheckIn,
      })
      .where(eq(secrets.id, secret.id))
    await scheduleRemindersForSecret(
      secret.id,
      secondUnpauseNextCheckIn,
      checkInDays,
    )

    const allReminders = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, secret.id))

    const pendingReminders = allReminders.filter((r) => r.status === "pending")

    expect(pendingReminders.length).toBeGreaterThan(0)

    for (const reminder of pendingReminders) {
      expect(reminder.scheduledFor.getTime()).toBeGreaterThan(
        secondUnpause.getTime(),
      )
      expect(reminder.scheduledFor.getTime()).toBeLessThan(
        secondUnpauseNextCheckIn.getTime(),
      )
    }

    vi.useRealTimers()
  })
})
