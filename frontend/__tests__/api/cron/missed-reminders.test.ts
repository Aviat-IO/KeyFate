import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

vi.unmock("@/lib/db/drizzle")

import { POST } from "@/app/api/cron/check-secrets/route"
import { NextRequest } from "next/server"
import { getDatabase } from "@/lib/db/drizzle"
import { reminderJobs, secrets, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

vi.mock("@/lib/email/email-service", () => ({
  sendReminderEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/email/email-failure-logger", () => ({
  logEmailFailure: vi.fn(),
}))

vi.mock("@/lib/email/admin-notification-service", () => ({
  sendAdminNotification: vi.fn(),
}))

// Skip integration tests that need proper database cleanup
describe.skip("Missed Reminders Recovery", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>
  let testUserId: string
  let testSecretId: string

  beforeEach(async () => {
    db = await getDatabase()

    // Create test user with unique email
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    const [user] = await db
      .insert(users)
      .values({
        id: `test-user-${uniqueId}`,
        email: `test-${uniqueId}@example.com`,
        name: "Test User",
      })
      .returning()

    testUserId = user.id

    // Create test secret
    const nextCheckIn = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    const [secret] = await db
      .insert(secrets)
      .values({
        userId: testUserId,
        title: "Test Secret",
        recipientName: "Recipient",
        recipientEmail: "recipient@example.com",
        contactMethod: "email",
        checkInDays: 7,
        status: "active",
        serverShare: "test-share",
        nextCheckIn,
      } as any)
      .returning()

    testSecretId = secret.id
  })

  afterEach(async () => {
    if (testSecretId) {
      await db
        .delete(reminderJobs)
        .where(eq(reminderJobs.secretId, testSecretId))
      await db.delete(secrets).where(eq(secrets.id, testSecretId))
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

  it("should mark missed reminders (>2 hours overdue) for retry", async () => {
    // Create a reminder that was scheduled 3 hours ago (simulating Cloudflare outage)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)

    const [reminder] = await db
      .insert(reminderJobs)
      .values({
        secretId: testSecretId,
        reminderType: "50_percent",
        scheduledFor: threeHoursAgo,
        status: "pending",
      } as any)
      .returning()

    // Call the cron endpoint
    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    // Verify the missed reminder was marked
    expect(data.missedRemindersMarked).toBeGreaterThan(0)

    // Check the reminder status in DB
    const [updatedReminder] = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.id, reminder.id))

    expect(updatedReminder.status).toBe("failed")
    expect(updatedReminder.error).toContain("Missed due to cron outage")
    expect(updatedReminder.retryCount).toBe(0)
    expect(updatedReminder.nextRetryAt).toBeTruthy()
  })

  it("should process missed reminders within 7-day grace period", async () => {
    // Create a reminder scheduled 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

    await db.insert(reminderJobs).values({
      secretId: testSecretId,
      reminderType: "3_days",
      scheduledFor: twoDaysAgo,
      status: "pending",
    } as any)

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(data.missedRemindersMarked).toBeGreaterThan(0)
  })

  it("should NOT process reminders older than 7-day grace period", async () => {
    // Create a reminder scheduled 8 days ago (too old)
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)

    const [oldReminder] = await db
      .insert(reminderJobs)
      .values({
        secretId: testSecretId,
        reminderType: "7_days",
        scheduledFor: eightDaysAgo,
        status: "pending",
      } as any)
      .returning()

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      },
    )

    await POST(req)

    // Verify it wasn't marked for retry
    const [reminder] = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.id, oldReminder.id))

    expect(reminder.status).toBe("pending") // Still pending, not marked
  })

  it("should NOT mark reminders less than 2 hours overdue", async () => {
    // Create a reminder scheduled 1 hour ago (not missed yet)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const [recentReminder] = await db
      .insert(reminderJobs)
      .values({
        secretId: testSecretId,
        reminderType: "12_hours",
        scheduledFor: oneHourAgo,
        status: "pending",
      } as any)
      .returning()

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    // Should process normally, not mark as missed
    expect(data.remindersProcessed).toBeGreaterThan(0)

    const [reminder] = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.id, recentReminder.id))

    // Should be sent, not marked as failed
    expect(reminder.status).toBe("sent")
  })
})
