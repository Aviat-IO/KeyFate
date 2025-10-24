import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { eq } from "drizzle-orm"

vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
}))

vi.mock("@/lib/db/schema", async () => {
  const actual = await vi.importActual("@/lib/db/schema")
  return {
    ...actual,
    auditLogs: {
      id: "id",
      userId: "userId",
      eventType: "eventType",
      eventCategory: "eventCategory",
      resourceType: "resourceType",
      resourceId: "resourceId",
      details: "details",
      ipAddress: "ipAddress",
      userAgent: "userAgent",
      createdAt: "createdAt",
    },
  }
})

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn((header: string) => {
      if (header === "x-forwarded-for") return "192.168.1.1"
      if (header === "user-agent") return "test-agent"
      return null
    }),
  })),
}))

import {
  logLogin,
  logSubscriptionChanged,
  logSecretCreated,
  logCheckIn,
} from "../audit-logger"
import { getDatabase } from "@/lib/db/drizzle"
import { auditLogs } from "@/lib/db/schema"

describe("Audit Logger", () => {
  const mockDb = {
    insert: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    delete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    })
    ;(getDatabase as any).mockResolvedValue(mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("logLogin", () => {
    it("should log Google OAuth login with resource info", async () => {
      const userId = "user-123"
      const email = "test@example.com"

      await logLogin(userId, {
        provider: "google",
        email,
        newUser: true,
        resourceType: "auth_method",
        resourceId: `google:${email}`,
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "login",
          eventCategory: "authentication",
          resourceType: "auth_method",
          resourceId: `google:${email}`,
          ipAddress: "192.168.1.1",
          userAgent: "test-agent",
          details: expect.objectContaining({
            provider: "google",
            email,
            newUser: true,
            resourceType: "auth_method",
            resourceId: `google:${email}`,
          }),
        }),
      )
    })

    it("should log OTP login with resource info", async () => {
      const userId = "user-456"
      const email = "otp@example.com"

      await logLogin(userId, {
        provider: "credentials",
        email,
        resourceType: "auth_method",
        resourceId: `otp:${email}`,
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "login",
          eventCategory: "authentication",
          resourceType: "auth_method",
          resourceId: `otp:${email}`,
          details: expect.objectContaining({
            provider: "credentials",
            email,
            resourceType: "auth_method",
            resourceId: `otp:${email}`,
          }),
        }),
      )
    })

    it("should handle login without resource info (backward compatibility)", async () => {
      const userId = "user-789"

      await logLogin(userId, {
        provider: "credentials",
        email: "legacy@example.com",
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "login",
          eventCategory: "authentication",
        }),
      )
    })
  })

  describe("logSubscriptionChanged", () => {
    it("should log subscription creation with resource info", async () => {
      const userId = "user-123"

      await logSubscriptionChanged(userId, {
        action: "created",
        tier: "pro",
        provider: "stripe",
        status: "active",
        resourceType: "subscription",
        resourceId: "stripe:pro",
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "subscription_changed",
          eventCategory: "subscriptions",
          resourceType: "subscription",
          resourceId: "stripe:pro",
          details: expect.objectContaining({
            action: "created",
            tier: "pro",
            provider: "stripe",
            status: "active",
          }),
        }),
      )
    })

    it("should log payment processed with resource info", async () => {
      const userId = "user-456"
      const paymentId = "pi_123456"

      await logSubscriptionChanged(userId, {
        action: "payment_processed",
        provider: "btcpay",
        amount: "9.00",
        status: "succeeded",
        paymentId,
        resourceType: "payment",
        resourceId: `btcpay:${paymentId}`,
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "subscription_changed",
          eventCategory: "subscriptions",
          resourceType: "payment",
          resourceId: `btcpay:${paymentId}`,
          details: expect.objectContaining({
            action: "payment_processed",
            provider: "btcpay",
            amount: "9.00",
            status: "succeeded",
            paymentId,
          }),
        }),
      )
    })

    it("should log downgrade scheduled with resource info", async () => {
      const userId = "user-789"
      const scheduledFor = new Date("2025-12-31")

      await logSubscriptionChanged(userId, {
        action: "downgrade_scheduled",
        scheduledFor,
        resourceType: "subscription",
        resourceId: "downgrade:free",
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "subscription_changed",
          eventCategory: "subscriptions",
          resourceType: "subscription",
          resourceId: "downgrade:free",
          details: expect.objectContaining({
            action: "downgrade_scheduled",
            scheduledFor,
          }),
        }),
      )
    })

    it("should log downgrade executed with resource info", async () => {
      const userId = "user-999"

      await logSubscriptionChanged(userId, {
        action: "downgrade_executed",
        from: "pro",
        to: "free",
        resourceType: "subscription",
        resourceId: "pro:free",
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "subscription_changed",
          eventCategory: "subscriptions",
          resourceType: "subscription",
          resourceId: "pro:free",
          details: expect.objectContaining({
            action: "downgrade_executed",
            from: "pro",
            to: "free",
          }),
        }),
      )
    })
  })

  describe("logSecretCreated", () => {
    it("should log secret creation with resource info", async () => {
      const userId = "user-123"
      const secretId = "secret-abc-123"

      await logSecretCreated(userId, secretId, {
        title: "Test Secret",
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "secret_created",
          eventCategory: "secrets",
          resourceType: "secret",
          resourceId: secretId,
          details: expect.objectContaining({
            title: "Test Secret",
          }),
        }),
      )
    })
  })

  describe("logCheckIn", () => {
    it("should log check-in with resource info", async () => {
      const userId = "user-123"
      const secretId = "secret-xyz-789"

      await logCheckIn(userId, secretId, {
        method: "token",
      })

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs)
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: "check_in",
          eventCategory: "secrets",
          resourceType: "secret",
          resourceId: secretId,
          details: expect.objectContaining({
            method: "token",
          }),
        }),
      )
    })
  })

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("Database error")),
      })

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {})

      await logLogin("user-123", {
        provider: "google",
        email: "test@example.com",
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Audit Logger] Failed to log audit event:",
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
