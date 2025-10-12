import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Create mock database instance
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock dependencies
vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  db: mockDb, // Keep for backward compatibility
}))

vi.mock("@/lib/auth/rate-limiting", () => ({
  checkRateLimit: vi.fn(),
}))

describe("Enhanced Verify Email API", () => {
  let mockDb: any
  let mockCheckRateLimit: any

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    const { db } = await import("@/lib/db/drizzle")
    const { checkRateLimit } = await import("@/lib/auth/rate-limiting")

    mockDb = db as any
    mockCheckRateLimit = checkRateLimit as any

    // Setup default mock chain
    const mockSelect = vi.fn().mockReturnThis()
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])
    const mockUpdate = vi.fn().mockReturnThis()
    const mockSet = vi.fn().mockReturnThis()
    const mockDelete = vi.fn().mockReturnThis()

    mockDb.select.mockImplementation(() => ({
      from: mockFrom.mockImplementation(() => ({
        where: mockWhere.mockImplementation(() => ({
          limit: mockLimit,
        })),
      })),
    }))

    mockDb.update.mockImplementation(() => ({
      set: mockSet.mockImplementation(() => ({
        where: mockWhere,
      })),
    }))

    mockDb.delete.mockImplementation(() => ({
      where: mockWhere,
    }))

    // Default rate limit allows requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: new Date(Date.now() + 15 * 60 * 1000),
    })
  })

  describe("POST /api/auth/verify-email", () => {
    it("should verify email with valid token when rate limit allows", async () => {
      // Arrange
      const mockVerificationToken = {
        identifier: "user@example.com",
        token: "valid-token-123",
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
        emailVerified: null,
      }

      mockDb
        .select()
        .from()
        .where()
        .limit.mockResolvedValueOnce([mockVerificationToken])
        .mockResolvedValueOnce([mockUser])

      mockDb.update().set().where.mockResolvedValue([])
      mockDb.delete().where.mockResolvedValue([])

      const request = new Request(
        "http://localhost:3000/api/auth/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@example.com",
            token: "valid-token-123",
          }),
        },
      )

      const { POST } = await import("@/app/api/auth/verify-email/route")

      // Act
      const response = await POST(request as NextRequest)
      const result = await response.json()

      // Assert
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "verify-email",
        "user@example.com",
      )
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.verified).toBe(true)
    })

    it("should block verification when rate limit exceeded", async () => {
      // Arrange
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 300,
        resetTime: new Date(Date.now() + 15 * 60 * 1000),
      })

      const request = new Request(
        "http://localhost:3000/api/auth/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@example.com",
            token: "valid-token-123",
          }),
        },
      )

      const { POST } = await import("@/app/api/auth/verify-email/route")

      // Act
      const response = await POST(request as NextRequest)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(429)
      expect(result.success).toBe(false)
      expect(result.error).toContain("Too many verification attempts")
      expect(result.retryAfter).toBe(300)
      expect(response.headers.get("Retry-After")).toBe("300")
    })

    it("should include rate limit headers in successful responses", async () => {
      // Arrange
      const mockVerificationToken = {
        identifier: "user@example.com",
        token: "valid-token-123",
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 3,
        resetTime: new Date(Date.now() + 15 * 60 * 1000),
      })

      mockDb
        .select()
        .from()
        .where()
        .limit.mockResolvedValueOnce([mockVerificationToken])
        .mockResolvedValueOnce([mockUser])

      mockDb.update().set().where.mockResolvedValue([])
      mockDb.delete().where.mockResolvedValue([])

      const request = new Request(
        "http://localhost:3000/api/auth/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@example.com",
            token: "valid-token-123",
          }),
        },
      )

      const { POST } = await import("@/app/api/auth/verify-email/route")

      // Act
      const response = await POST(request as NextRequest)

      // Assert
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("3")
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined()
    })

    it("should reject expired token and clean it up", async () => {
      // Arrange
      const mockExpiredToken = {
        identifier: "user@example.com",
        token: "expired-token-123",
        expires: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }

      mockDb.select().from().where().limit.mockResolvedValue([mockExpiredToken])
      mockDb.delete().where.mockResolvedValue([])

      const request = new Request(
        "http://localhost:3000/api/auth/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@example.com",
            token: "expired-token-123",
          }),
        },
      )

      const { POST } = await import("@/app/api/auth/verify-email/route")

      // Act
      const response = await POST(request as NextRequest)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe("Verification token has expired")
      expect(mockDb.delete).toHaveBeenCalled() // Token cleanup
    })

    it("should handle already verified users gracefully", async () => {
      // Arrange
      const mockVerificationToken = {
        identifier: "user@example.com",
        token: "valid-token-123",
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      const mockVerifiedUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: new Date("2024-01-01"),
      }

      mockDb
        .select()
        .from()
        .where()
        .limit.mockResolvedValueOnce([mockVerificationToken])
        .mockResolvedValueOnce([mockVerifiedUser])

      const request = new Request(
        "http://localhost:3000/api/auth/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@example.com",
            token: "valid-token-123",
          }),
        },
      )

      const { POST } = await import("@/app/api/auth/verify-email/route")

      // Act
      const response = await POST(request as NextRequest)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.verified).toBe(true)
      expect(result.message).toContain("already verified")
    })

    it("should validate input with comprehensive error messages", async () => {
      const invalidInputs = [
        { email: "", token: "" },
        { email: "invalid-email", token: "token" },
        { email: "user@example.com", token: "" },
        { email: "user@example.com" }, // missing token
        { token: "token" }, // missing email
      ]

      for (const input of invalidInputs) {
        const request = new Request(
          "http://localhost:3000/api/auth/verify-email",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        )

        const { POST } = await import("@/app/api/auth/verify-email/route")

        // Act
        const response = await POST(request as NextRequest)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(result.success).toBe(false)
        expect(result.error).toContain("required")
        expect(result.details).toBeDefined()
      }
    })

    it("should log verification attempts for security monitoring", async () => {
      // This test will drive implementation of security logging
      const mockVerificationToken = {
        identifier: "user@example.com",
        token: "valid-token-123",
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      mockDb
        .select()
        .from()
        .where()
        .limit.mockResolvedValueOnce([mockVerificationToken])
        .mockResolvedValueOnce([mockUser])

      mockDb.update().set().where.mockResolvedValue([])
      mockDb.delete().where.mockResolvedValue([])

      const consoleSpy = vi.spyOn(console, "log")

      const request = new Request(
        "http://localhost:3000/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Test Browser",
          },
          body: JSON.stringify({
            email: "user@example.com",
            token: "valid-token-123",
          }),
        },
      )

      const { POST } = await import("@/app/api/auth/verify-email/route")

      // Act
      await POST(request as NextRequest)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[VerifyEmail] Successfully verified email for user: user-123",
        ),
      )

      consoleSpy.mockRestore()
    })
  })
})
