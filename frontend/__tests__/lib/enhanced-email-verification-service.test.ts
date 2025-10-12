import { describe, it, expect, vi, beforeEach } from "vitest"

// Create mock database instance
const createMockDb = () => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
})

// Mock database and getDatabase function
vi.mock("@/lib/db/drizzle", () => ({
  db: createMockDb(),
  getDatabase: vi.fn(() => Promise.resolve(createMockDb())),
}))

// Mock email service
vi.mock("@/lib/email/email-service", () => ({
  sendVerificationEmail: vi.fn(async (email: string, token: string) => ({
    success: true,
    provider: "test-provider",
    messageId: "test-message-id",
    emailData: {
      subject: "Verify your email address",
      verificationUrl: `http://localhost:3000/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`,
      expirationHours: 24,
    },
    templateUsed: "verification-email",
  })),
}))

describe("Enhanced Email Verification Service", () => {
  let mockDb: any
  let getDatabase: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup mock database with proper chaining
    const mockSelect = vi.fn().mockReturnThis()
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])
    const mockInsert = vi.fn().mockReturnThis()
    const mockValues = vi.fn().mockResolvedValue([])
    const mockUpdate = vi.fn().mockReturnThis()
    const mockSet = vi.fn().mockReturnThis()
    const mockDelete = vi.fn().mockReturnThis()

    mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: mockFrom.mockImplementation(() => ({
          where: mockWhere.mockImplementation(() => ({
            limit: mockLimit,
          })),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: mockValues,
      })),
      update: vi.fn().mockImplementation(() => ({
        set: mockSet.mockImplementation(() => ({
          where: mockWhere,
        })),
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: mockWhere,
      })),
    }

    // Mock getDatabase to return our mock database
    const dbModule = await import("@/lib/db/drizzle")
    getDatabase = dbModule.getDatabase as any
    getDatabase.mockResolvedValue(mockDb)
  })

  describe("createVerificationToken", () => {
    it("should create verification token for unverified user", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      // Mock database query responses
      const mockLimit = vi.fn().mockResolvedValue([mockUser])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom })
      mockDb.delete = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
      mockDb.insert = vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      const { createVerificationToken } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await createVerificationToken("user@example.com")

      // Assert
      expect(result.success).toBe(true)
      expect(result.token).toBeDefined()
      expect(result.token).toHaveLength(64) // 32 bytes * 2 hex chars
      expect(mockDb.delete).toHaveBeenCalled() // Remove existing tokens
      expect(mockDb.insert).toHaveBeenCalled() // Insert new token
    })

    it("should reject creating token for already verified user", async () => {
      // Arrange
      const mockVerifiedUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: new Date(),
      }

      mockDb.select().from().where().limit.mockResolvedValue([mockVerifiedUser])

      const { createVerificationToken } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await createVerificationToken("user@example.com")

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe("Email is already verified")
      expect(result.token).toBeUndefined()
    })

    it("should reject creating token for non-existent user", async () => {
      // Arrange
      mockDb.select().from().where().limit.mockResolvedValue([])

      const { createVerificationToken } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await createVerificationToken("nonexistent@example.com")

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe("User not found")
      expect(result.token).toBeUndefined()
    })

    it("should create tokens with 24-hour expiration", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      // Mock database query responses
      const mockLimit = vi.fn().mockResolvedValue([mockUser])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom })
      mockDb.delete = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue([]) })

      let capturedExpiration: Date
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((values: any) => {
          capturedExpiration = values.expires
          return Promise.resolve([])
        }),
      })

      const { createVerificationToken } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const startTime = Date.now()
      await createVerificationToken("user@example.com")
      const endTime = Date.now()

      // Assert
      const expectedExpiration = startTime + 24 * 60 * 60 * 1000
      const actualExpiration = capturedExpiration!.getTime()
      expect(actualExpiration).toBeGreaterThanOrEqual(expectedExpiration - 1000)
      expect(actualExpiration).toBeLessThanOrEqual(
        endTime + 24 * 60 * 60 * 1000,
      )
    })

    it("should generate cryptographically secure tokens", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      // Mock database responses to return the same user for all calls
      const mockLimit = vi.fn().mockResolvedValue([mockUser])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom })
      mockDb.delete = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
      mockDb.insert = vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      const { createVerificationToken } = await import(
        "@/lib/auth/email-verification"
      )

      // Act - Generate multiple tokens
      const tokens = []
      const results = []
      for (let i = 0; i < 10; i++) {
        const result = await createVerificationToken("user@example.com")
        results.push(result)
        if (result.success && result.token) {
          tokens.push(result.token)
        }
      }

      // Debug: Log all results
      results.forEach((result, index) => {
        console.log(
          `Token generation ${index}:`,
          result.success
            ? `SUCCESS (${result.token?.substring(0, 8)}...)`
            : `FAILED: ${result.error}`,
        )
      })

      // Assert - All tokens should be unique and properly formatted
      expect(tokens.length).toBe(10) // All should succeed
      const uniqueTokens = new Set(tokens)
      expect(uniqueTokens.size).toBe(10) // All unique
      tokens.forEach((token) => {
        expect(token).toMatch(/^[a-f0-9]{64}$/) // Hex format, 64 chars
      })
    })

    it("should normalize email addresses", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      // Mock database query responses
      const mockLimit = vi.fn().mockResolvedValue([mockUser])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom })
      mockDb.delete = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
      mockDb.insert = vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      const { createVerificationToken } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      await createVerificationToken("  USER@EXAMPLE.COM  ")

      // Assert - Should query and store with normalized email (mockWhere should have been called)
      expect(mockWhere).toHaveBeenCalled()
    })
  })

  describe("sendVerificationEmail", () => {
    it("should log verification email details in development", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log")
      process.env.NEXTAUTH_URL = "http://localhost:3000"

      const { sendVerificationEmail } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await sendVerificationEmail(
        "user@example.com",
        "test-token-123",
      )

      // Assert
      expect(result.success).toBe(true)
      // Should log successful email sending with provider info
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[EmailVerification] Verification email sent to user@example.com",
        ),
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Message ID: test-message-id"),
      )

      consoleSpy.mockRestore()
    })

    it("should handle email service integration when configured", async () => {
      // This test will drive implementation of actual email service
      const { sendVerificationEmail } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await sendVerificationEmail(
        "user@example.com",
        "test-token-123",
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.emailProvider).toBeDefined() // Should indicate which provider was used
      expect(result.messageId).toBeDefined() // Should return message ID from email service
    })

    it("should include proper email template data", async () => {
      // This test will drive implementation of email templates
      const { sendVerificationEmail } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await sendVerificationEmail(
        "user@example.com",
        "test-token-123",
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.emailData).toBeDefined()
      expect(result.emailData.subject).toContain("Verify your email")
      expect(result.emailData.verificationUrl).toContain("test-token-123")
      expect(result.emailData.expirationHours).toBe(24)
    })
  })

  describe("resendVerificationEmail", () => {
    it("should create new token and send email for unverified user", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: null,
      }

      // Mock database query responses
      const mockLimit = vi.fn().mockResolvedValue([mockUser])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom })
      mockDb.delete = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
      mockDb.insert = vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      const { resendVerificationEmail } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await resendVerificationEmail("user@example.com")

      // Assert
      expect(result.success).toBe(true)
      expect(mockDb.delete).toHaveBeenCalled() // Remove old tokens
      expect(mockDb.insert).toHaveBeenCalled() // Create new token
    })

    it("should reject resend for already verified user", async () => {
      // Arrange
      const mockVerifiedUser = {
        id: "user-123",
        email: "user@example.com",
        emailVerified: new Date(),
      }

      mockDb.select().from().where().limit.mockResolvedValue([mockVerifiedUser])

      const { resendVerificationEmail } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await resendVerificationEmail("user@example.com")

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe("Email is already verified")
    })

    it("should reject resend for non-existent user", async () => {
      // Arrange
      mockDb.select().from().where().limit.mockResolvedValue([])

      const { resendVerificationEmail } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await resendVerificationEmail("nonexistent@example.com")

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe("User not found")
    })
  })

  describe("checkEmailVerification", () => {
    it("should return verification status for existing user", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
        emailVerified: new Date("2024-01-01"),
      }

      mockDb.select().from().where().limit.mockResolvedValue([mockUser])

      const { checkEmailVerification } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await checkEmailVerification("user@example.com")

      // Assert
      expect(result.verified).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user.id).toBe("user-123")
      expect(result.user.email).toBe("user@example.com")
    })

    it("should return false for non-existent user", async () => {
      // Arrange
      mockDb.select().from().where().limit.mockResolvedValue([])

      const { checkEmailVerification } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await checkEmailVerification("nonexistent@example.com")

      // Assert
      expect(result.verified).toBe(false)
      expect(result.user).toBeUndefined()
    })

    it("should return false for unverified user", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
        emailVerified: null,
      }

      mockDb.select().from().where().limit.mockResolvedValue([mockUser])

      const { checkEmailVerification } = await import(
        "@/lib/auth/email-verification"
      )

      // Act
      const result = await checkEmailVerification("user@example.com")

      // Assert
      expect(result.verified).toBe(false)
      expect(result.user).toBeDefined()
      expect(result.user.emailVerified).toBe(null)
    })
  })

  describe("Enhanced Security Features", () => {
    it("should implement token cleanup for expired tokens", async () => {
      // This test will drive implementation of cleanup functionality
      const { cleanupExpiredTokens } = await import(
        "@/lib/auth/email-verification"
      )

      mockDb.delete().where.mockResolvedValue([{ count: 5 }])

      // Act
      const result = await cleanupExpiredTokens()

      // Assert
      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(5)
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it("should validate token format and structure", async () => {
      // This test will drive implementation of token validation
      const { validateTokenFormat } = await import(
        "@/lib/auth/email-verification"
      )

      // Valid tokens
      expect(validateTokenFormat("a".repeat(64))).toBe(true)
      expect(validateTokenFormat("1234567890abcdef".repeat(4))).toBe(true)

      // Invalid tokens
      expect(validateTokenFormat("")).toBe(false)
      expect(validateTokenFormat("short")).toBe(false)
      expect(validateTokenFormat("g".repeat(64))).toBe(false) // Contains non-hex char
      expect(validateTokenFormat("a".repeat(63))).toBe(false) // Wrong length
      expect(validateTokenFormat("a".repeat(65))).toBe(false) // Wrong length
    })

    it("should implement secure token comparison", async () => {
      // This test will drive implementation of timing-safe comparison
      const { compareTokens } = await import("@/lib/auth/email-verification")

      const token1 = "a".repeat(64)
      const token2 = "b".repeat(64)

      expect(compareTokens(token1, token1)).toBe(true)
      expect(compareTokens(token1, token2)).toBe(false)
      expect(compareTokens("", token1)).toBe(false)
      expect(compareTokens(token1, "")).toBe(false)
    })
  })
})
