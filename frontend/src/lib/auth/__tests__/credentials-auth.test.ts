import { describe, it, expect, beforeEach, vi } from "vitest"
import { validatePassword, hashPassword, verifyPassword } from "../password"
import { createUser } from "../users"

// Mock the database
vi.mock("@/lib/db/drizzle", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
  }

  return {
    getDatabase: vi.fn(() => Promise.resolve(mockDb)),
    db: mockDb,
  }
})

// Mock email verification functions
vi.mock("../email-verification", () => ({
  createVerificationToken: vi.fn(() =>
    Promise.resolve({ success: true, token: "mock-token" }),
  ),
  sendVerificationEmail: vi.fn(() => Promise.resolve({ success: true })),
}))

describe("Password Utilities", () => {
  describe("validatePassword", () => {
    it("should accept valid passwords", () => {
      const result = validatePassword("Password123!")
      expect(result.isValid).toBe(true)
      expect(result.message).toBe("Password is valid")
    })

    it("should reject short passwords", () => {
      const result = validatePassword("Short1!")
      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        "Password must be at least 10 characters long",
      )
    })

    it("should reject passwords without lowercase", () => {
      const result = validatePassword("PASSWORD123!")
      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        "Password must contain at least one lowercase letter",
      )
    })

    it("should reject passwords without uppercase", () => {
      const result = validatePassword("password123!")
      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        "Password must contain at least one uppercase letter",
      )
    })

    it("should reject passwords without numbers", () => {
      const result = validatePassword("PasswordABC!")
      expect(result.isValid).toBe(false)
      expect(result.message).toBe("Password must contain at least one number")
    })

    it("should reject passwords without special characters", () => {
      const result = validatePassword("Password123")
      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        "Password must contain at least one special character (!@#$%^&*)",
      )
    })
  })

  describe("Password Hashing", () => {
    it("should hash and verify passwords correctly", async () => {
      const password = "TestPassword123!"
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)

      const isInvalid = await verifyPassword("WrongPassword", hash)
      expect(isInvalid).toBe(false)
    })
  })
})

describe("User Management", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createUser", () => {
    it("should validate input parameters", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      // Mock existing user check - return empty array (no existing user)
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      // Mock user creation
      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "test-id",
              email: "test@example.com",
              name: "Test User",
              password: "hashed-password",
              emailVerified: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      } as any)

      const result = await createUser({
        email: "test@example.com",
        password: "TestPassword123!",
        name: "Test User",
      })

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.email).toBe("test@example.com")
      expect(result.user?.name).toBe("Test User")
      // Password should not be returned
      expect((result.user as any)?.password).toBeUndefined()
    })
  })
})
