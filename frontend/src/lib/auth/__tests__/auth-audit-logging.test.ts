import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

vi.unmock("@/lib/db/drizzle")

import { getDatabase } from "@/lib/db/drizzle"
import { users, auditLogs } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn((header: string) => {
      if (header === "x-forwarded-for") return "203.0.113.42"
      if (header === "user-agent") return "Mozilla/5.0 Test Browser"
      return null
    }),
  })),
}))

// Skip these integration tests in CI/unit test runs - they require a real database
const shouldSkip = !process.env.RUN_INTEGRATION_TESTS

describe.skipIf(shouldSkip)("Authentication Audit Logging Integration", () => {
  let db: Awaited<ReturnType<typeof getDatabase>>
  let testUserId: string

  beforeEach(async () => {
    db = await getDatabase()
    testUserId = `test-user-${Date.now()}-${Math.random()}`
  })

  afterEach(async () => {
    if (testUserId) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, testUserId))
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

  describe("Google OAuth Login Audit", () => {
    it("should create audit log entry for new Google OAuth user", async () => {
      const { logLogin } = await import("@/lib/services/audit-logger")
      const testEmail = `test-${Date.now()}@example.com`

      await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        emailVerified: new Date(),
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      })

      await logLogin(testUserId, {
        provider: "google",
        email: testEmail,
        newUser: true,
        resourceType: "auth_method",
        resourceId: `google:${testEmail}`,
      })

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1)

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        userId: testUserId,
        eventType: "login",
        eventCategory: "authentication",
        resourceType: "auth_method",
        resourceId: `google:${testEmail}`,
      })
      expect(logs[0].details).toMatchObject({
        provider: "google",
        email: testEmail,
        newUser: true,
      })
      expect(logs[0].ipAddress).toBe("203.0.113.42")
      expect(logs[0].userAgent).toBe("Mozilla/5.0 Test Browser")
    })

    it("should create audit log entry for existing Google OAuth user", async () => {
      const { logLogin } = await import("@/lib/services/audit-logger")
      const testEmail = `existing-${Date.now()}@example.com`

      await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        emailVerified: new Date(),
        name: "Existing User",
      })

      await logLogin(testUserId, {
        provider: "google",
        email: testEmail,
        newUser: false,
        resourceType: "auth_method",
        resourceId: `google:${testEmail}`,
      })

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId))
        .limit(1)

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        eventType: "login",
        resourceType: "auth_method",
        resourceId: `google:${testEmail}`,
      })
      expect(logs[0].details).toMatchObject({
        provider: "google",
        newUser: false,
      })
    })
  })

  describe("OTP Login Audit", () => {
    it("should create audit log entry for OTP authentication", async () => {
      const { logLogin } = await import("@/lib/services/audit-logger")
      const testEmail = `otp-${Date.now()}@example.com`

      await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        emailVerified: new Date(),
      })

      await logLogin(testUserId, {
        provider: "credentials",
        email: testEmail,
        resourceType: "auth_method",
        resourceId: `otp:${testEmail}`,
      })

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId))
        .limit(1)

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        userId: testUserId,
        eventType: "login",
        eventCategory: "authentication",
        resourceType: "auth_method",
        resourceId: `otp:${testEmail}`,
      })
      expect(logs[0].details).toMatchObject({
        provider: "credentials",
        email: testEmail,
      })
      expect(logs[0].ipAddress).toBe("203.0.113.42")
      expect(logs[0].userAgent).toBe("Mozilla/5.0 Test Browser")
    })
  })

  describe("Audit Trail Verification", () => {
    it("should maintain chronological order of login events", async () => {
      const { logLogin } = await import("@/lib/services/audit-logger")
      const testEmail = `multi-${Date.now()}@example.com`

      await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        emailVerified: new Date(),
      })

      await logLogin(testUserId, {
        provider: "otp",
        email: testEmail,
        resourceType: "auth_method",
        resourceId: `otp:${testEmail}`,
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await logLogin(testUserId, {
        provider: "google",
        email: testEmail,
        resourceType: "auth_method",
        resourceId: `google:${testEmail}`,
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await logLogin(testUserId, {
        provider: "otp",
        email: testEmail,
        resourceType: "auth_method",
        resourceId: `otp:${testEmail}`,
      })

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId))
        .orderBy(desc(auditLogs.createdAt))

      expect(logs).toHaveLength(3)
      expect(logs[0].resourceId).toBe(`otp:${testEmail}`)
      expect(logs[1].resourceId).toBe(`google:${testEmail}`)
      expect(logs[2].resourceId).toBe(`otp:${testEmail}`)
    })

    it("should capture all required audit fields", async () => {
      const { logLogin } = await import("@/lib/services/audit-logger")
      const testEmail = `fields-${Date.now()}@example.com`

      await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        emailVerified: new Date(),
      })

      await logLogin(testUserId, {
        provider: "google",
        email: testEmail,
        newUser: true,
        resourceType: "auth_method",
        resourceId: `google:${testEmail}`,
      })

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId))
        .limit(1)

      expect(log).toBeDefined()
      expect(log.id).toBeDefined()
      expect(log.userId).toBe(testUserId)
      expect(log.eventType).toBe("login")
      expect(log.eventCategory).toBe("authentication")
      expect(log.resourceType).toBe("auth_method")
      expect(log.resourceId).toBe(`google:${testEmail}`)
      expect(log.ipAddress).toBeDefined()
      expect(log.userAgent).toBeDefined()
      expect(log.createdAt).toBeDefined()
      expect(log.details).toBeDefined()
    })
  })
})
