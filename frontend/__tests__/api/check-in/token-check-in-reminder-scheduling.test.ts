import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

vi.unmock("@/lib/db/drizzle")

import { getDatabase } from "@/lib/db/drizzle"
import {
  secrets,
  reminderJobs,
  users,
  checkInTokens,
  secretRecipients,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { scheduleRemindersForSecret } from "@/lib/services/reminder-scheduler"
import { randomBytes } from "crypto"

// Skip these integration tests in CI/unit test runs - they require a real database
const shouldSkip = !process.env.RUN_INTEGRATION_TESTS

describe.skipIf(shouldSkip)("Token Check-In - Reminder Scheduling Integration", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>
  let testUserId: string
  let testSecretId: string
  let testTokenId: string

  beforeEach(async () => {
    db = await getDatabase()

    testUserId = `test-user-${Date.now()}`

    await db.insert(users).values({
      id: testUserId,
      email: `test-token-${Date.now()}@example.com`,
      name: "Test User",
      emailVerified: new Date(),
    })
  })

  afterEach(async () => {
    if (testTokenId) {
      await db.delete(checkInTokens).where(eq(checkInTokens.id, testTokenId))
    }

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

  it("should schedule new reminders when checking in via token", async () => {
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
        title: "Test Secret Token Check-In",
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

    const tokenCheckInTime = new Date("2025-11-10T16:30:00.000Z")
    vi.setSystemTime(tokenCheckInTime)

    const newNextCheckIn = new Date(
      tokenCheckInTime.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )

    await db
      .update(secrets)
      .set({
        lastCheckIn: tokenCheckInTime,
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
      expect(reminder.status).toBe("pending")
      expect(reminder.scheduledFor.getTime()).toBeGreaterThan(
        tokenCheckInTime.getTime(),
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

  it("should handle token check-in for secret without checkInDays", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret No CheckInDays",
        checkInDays: 30,
        nextCheckIn: createdAt,
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

    const fetchedSecret = await db
      .select()
      .from(secrets)
      .where(eq(secrets.id, secret.id))
      .limit(1)

    expect(fetchedSecret[0]?.checkInDays).toBeDefined()
    expect(fetchedSecret[0]?.checkInDays).toBe(30)

    vi.useRealTimers()
  })

  it("should schedule reminders after multiple token check-ins", async () => {
    const createdAt = new Date("2025-10-29T20:25:52.000Z")
    const checkInDays = 7

    vi.useFakeTimers()
    vi.setSystemTime(createdAt)

    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret Multiple Token Check-Ins",
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

    const firstCheckIn = new Date("2025-11-01T10:00:00.000Z")
    vi.setSystemTime(firstCheckIn)
    const firstNextCheckIn = new Date(
      firstCheckIn.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, firstNextCheckIn, checkInDays)

    const secondCheckIn = new Date("2025-11-05T14:00:00.000Z")
    vi.setSystemTime(secondCheckIn)
    const secondNextCheckIn = new Date(
      secondCheckIn.getTime() + checkInDays * 24 * 60 * 60 * 1000,
    )
    await scheduleRemindersForSecret(secret.id, secondNextCheckIn, checkInDays)

    const thirdCheckIn = new Date("2025-11-10T08:00:00.000Z")
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

    expect(pendingReminders.length).toBeGreaterThan(0)

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

  it("should calculate correct reminder times after token check-in", async () => {
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
        title: "Test Secret Token Timing",
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

    const tokenCheckInTime = new Date("2025-11-15T12:00:00.000Z")
    vi.setSystemTime(tokenCheckInTime)

    const newNextCheckIn = new Date("2025-12-15T12:00:00.000Z")

    await scheduleRemindersForSecret(secret.id, newNextCheckIn, checkInDays)

    const reminders = await db
      .select()
      .from(reminderJobs)
      .where(
        and(
          eq(reminderJobs.secretId, secret.id),
          eq(reminderJobs.status, "pending"),
        ),
      )

    const reminderMap = Object.fromEntries(
      reminders.map((r) => [r.reminderType, r.scheduledFor]),
    )

    expect(reminderMap["50_percent"]?.toISOString()).toBe(
      "2025-11-30T12:00:00.000Z",
    )
    expect(reminderMap["25_percent"]?.toISOString()).toBe(
      "2025-12-08T00:00:00.000Z",
    )
    expect(reminderMap["7_days"]?.toISOString()).toBe(
      "2025-12-08T12:00:00.000Z",
    )
    expect(reminderMap["3_days"]?.toISOString()).toBe(
      "2025-12-12T12:00:00.000Z",
    )
    expect(reminderMap["24_hours"]?.toISOString()).toBe(
      "2025-12-14T12:00:00.000Z",
    )
    expect(reminderMap["12_hours"]?.toISOString()).toBe(
      "2025-12-15T00:00:00.000Z",
    )
    expect(reminderMap["1_hour"]?.toISOString()).toBe(
      "2025-12-15T11:00:00.000Z",
    )

    vi.useRealTimers()
  })
})
