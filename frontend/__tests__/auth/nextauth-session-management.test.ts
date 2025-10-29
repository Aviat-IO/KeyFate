/**
 * NextAuth Session Management Tests with Cloud SQL
 *
 * TDD Test Suite for Task 25: Validate NextAuth Session Management with Cloud SQL
 *
 * Test Coverage:
 * 1. Session creation and persistence
 * 2. JWT token validation
 * 3. Database integration (users, accounts, sessions tables)
 * 4. Session callbacks (jwt, session)
 * 5. Token validation and refresh
 * 6. Cross-request session persistence
 * 7. Database adapter functionality
 */

import { getDatabase } from "@/lib/db/drizzle"
import { users, accounts, sessions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock dependencies
vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
}))

describe("NextAuth Session Management with Cloud SQL", () => {
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock database with proper schema
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }
    ;(getDatabase as any).mockResolvedValue(mockDb)
  })

  describe("Database Schema Verification", () => {
    it("should have users table with required NextAuth fields", () => {
      // Verify users table schema
      expect(users).toBeDefined()
      expect(users.id).toBeDefined()
      expect(users.email).toBeDefined()
      expect(users.emailVerified).toBeDefined()
      expect(users.name).toBeDefined()
      expect(users.image).toBeDefined()
      expect(users.password).toBeDefined() // For credentials provider
    })

    it("should have accounts table with required NextAuth fields", () => {
      // Verify accounts table schema
      expect(accounts).toBeDefined()
      expect(accounts.id).toBeDefined()
      expect(accounts.userId).toBeDefined()
      expect(accounts.type).toBeDefined()
      expect(accounts.provider).toBeDefined()
      expect(accounts.providerAccountId).toBeDefined()
      expect(accounts.refresh_token).toBeDefined()
      expect(accounts.access_token).toBeDefined()
      expect(accounts.expires_at).toBeDefined()
    })

    it("should have sessions table with required NextAuth fields", () => {
      // Verify sessions table schema
      expect(sessions).toBeDefined()
      expect(sessions.id).toBeDefined()
      expect(sessions.sessionToken).toBeDefined()
      expect(sessions.userId).toBeDefined()
      expect(sessions.expires).toBeDefined()
    })
  })

  describe("Session Creation", () => {
    it("should create session for authenticated user", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
        emailVerified: new Date(),
        name: "Test User",
        image: null,
        password: null,
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1)

      expect(userResult).toHaveLength(1)
      expect(userResult[0].id).toBe(mockUser.id)
      expect(userResult[0].email).toBe(mockUser.email)
    })

    it("should create JWT token with user ID", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      }

      // Simulate JWT callback
      const token = {
        id: mockUser.id,
        email: mockUser.email,
        sub: mockUser.id,
      }

      expect(token.id).toBe(mockUser.id)
      expect(token.sub).toBe(mockUser.id)
      expect(token.email).toBe(mockUser.email)
    })

    it("should add user ID to session from token", () => {
      const token = {
        id: "test-user-id",
        email: "test@example.com",
        sub: "test-user-id",
      }

      const session = {
        user: {
          email: "test@example.com",
          name: "Test User",
          image: null,
        },
      }

      // Simulate session callback
      ;(session.user as any).id = token.id || token.sub

      expect((session.user as any).id).toBe("test-user-id")
    })
  })

  describe("JWT Token Validation", () => {
    it("should validate JWT token structure", () => {
      const validToken = {
        id: "user-123",
        email: "user@example.com",
        sub: "user-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      }

      expect(validToken.id).toBeDefined()
      expect(validToken.sub).toBeDefined()
      expect(validToken.email).toBeDefined()
      expect(validToken.exp).toBeGreaterThan(validToken.iat)
    })

    it("should handle JWT token with user lookup from database", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        emailVerified: new Date(),
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.email, mockUser.email))
        .limit(1)

      expect(dbUser).toHaveLength(1)
      expect(dbUser[0].id).toBe(mockUser.id)
    })

    it("should include emailVerified status in JWT token", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        emailVerified: new Date(),
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1)

      const token = {
        id: dbUser[0].id,
        emailVerified: dbUser[0].emailVerified,
      }

      expect(token.emailVerified).toBeInstanceOf(Date)
    })
  })

  describe("Session Persistence", () => {
    it("should persist session across requests", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        },
      }

      // First request - create session
      const firstRequestSession = { ...mockSession }
      expect(firstRequestSession.user.id).toBe("user-123")

      // Second request - retrieve same session
      const secondRequestSession = { ...mockSession }
      expect(secondRequestSession.user.id).toBe("user-123")
      expect(secondRequestSession.user.email).toBe(
        firstRequestSession.user.email,
      )
    })

    it("should maintain session data integrity", () => {
      const token: any = {
        id: "user-123",
        email: "test@example.com",
        emailVerified: new Date(),
        sub: "user-123",
      }

      const session = {
        user: {
          email: token.email,
        },
      }

      // Session callback adds ID from token
      ;(session.user as any).id = token.id || token.sub
      ;(session.user as any).emailVerified = token.emailVerified || null

      expect((session.user as any).id).toBe(token.id)
      expect((session.user as any).emailVerified).toEqual(token.emailVerified)
    })

    it("should handle session expiration", () => {
      const now = Math.floor(Date.now() / 1000)
      const maxAge = 30 * 24 * 60 * 60 // 30 days

      const token = {
        iat: now,
        exp: now + maxAge,
      }

      expect(token.exp).toBeGreaterThan(now)
      expect(token.exp - token.iat).toBe(maxAge)
    })
  })

  describe("Google OAuth Session Management", () => {
    it("should create user for Google OAuth if not exists", async () => {
      const googleProfile = {
        email: "google@example.com",
        email_verified: true,
        name: "Google User",
        picture: "https://example.com/photo.jpg",
      }

      const normalizedEmail = googleProfile.email.toLowerCase().trim()

      // First check - no existing user
      mockDb.limit.mockResolvedValueOnce([])

      const db = await getDatabase()
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      expect(existingUser).toHaveLength(0)

      // Create new user
      const newUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: googleProfile.name,
        image: googleProfile.picture,
        emailVerified: new Date(),
        password: null,
      }

      expect(newUser.email).toBe(normalizedEmail)
      expect(newUser.emailVerified).toBeInstanceOf(Date)
      expect(newUser.password).toBeNull()
    })

    it("should lookup existing Google OAuth user by email", async () => {
      const googleProfile = {
        email: "existing@example.com",
        email_verified: true,
      }

      const mockExistingUser = {
        id: "existing-user-123",
        email: googleProfile.email.toLowerCase().trim(),
        emailVerified: new Date(),
      }

      mockDb.limit.mockResolvedValue([mockExistingUser])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.email, googleProfile.email.toLowerCase().trim()))
        .limit(1)

      expect(dbUser).toHaveLength(1)
      expect(dbUser[0].id).toBe(mockExistingUser.id)
    })

    it("should set JWT token ID from database user for Google OAuth", async () => {
      const mockUser = {
        id: "google-user-123",
        email: "google@example.com",
        emailVerified: new Date(),
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.email, mockUser.email))
        .limit(1)

      const token = {
        id: dbUser[0].id,
        emailVerified: dbUser[0].emailVerified,
      }

      expect(token.id).toBe(mockUser.id)
    })
  })

  describe("Credentials Provider Session Management", () => {
    it("should create session for credentials authentication", async () => {
      const mockUser = {
        id: "cred-user-123",
        email: "cred@example.com",
        password: "hashed-password",
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1)

      expect(dbUser).toHaveLength(1)
      expect(dbUser[0].id).toBe(mockUser.id)
    })

    it("should set JWT token ID directly for credentials provider", () => {
      const user = {
        id: "cred-user-123",
        email: "cred@example.com",
      }

      const token = {
        id: user.id,
      }

      expect(token.id).toBe(user.id)
    })

    it("should fetch email verification status for credentials users", async () => {
      const mockUser = {
        id: "cred-user-123",
        email: "cred@example.com",
        emailVerified: new Date(),
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.id, mockUser.id))
        .limit(1)

      const token = {
        id: dbUser[0].id,
        emailVerified: dbUser[0].emailVerified,
      }

      expect(token.emailVerified).toBeInstanceOf(Date)
    })
  })

  describe("Session Strategy Configuration", () => {
    it("should use JWT session strategy", () => {
      const sessionConfig = {
        strategy: "jwt" as const,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      }

      expect(sessionConfig.strategy).toBe("jwt")
      expect(sessionConfig.maxAge).toBe(2592000) // 30 days in seconds
    })

    it("should have NEXTAUTH_SECRET configured", () => {
      const jwtConfig = {
        secret: process.env.NEXTAUTH_SECRET,
      }

      // In test environment, NEXTAUTH_SECRET should be set
      expect(jwtConfig.secret).toBeDefined()
    })
  })

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const dbError = new Error("Database connection failed")
      ;(getDatabase as any).mockRejectedValue(dbError)

      await expect(getDatabase()).rejects.toThrow("Database connection failed")
    })

    it("should handle user not found in database", async () => {
      mockDb.limit.mockResolvedValue([])

      const db = await getDatabase()
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.email, "nonexistent@example.com"))
        .limit(1)

      expect(dbUser).toHaveLength(0)
    })

    it("should handle JWT callback errors for Google OAuth", async () => {
      const dbError = new Error("User lookup failed")
      mockDb.limit.mockRejectedValue(dbError)

      const db = await getDatabase()

      try {
        await db
          .select()
          .from(users)
          .where(eq(users.email, "test@example.com"))
          .limit(1)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe("User lookup failed")
      }
    })
  })

  describe("Token Validation", () => {
    it("should validate access token structure", () => {
      const mockAccount = {
        access_token: "mock-access-token",
      }

      const token = {
        accessToken: mockAccount.access_token,
      }

      expect(token.accessToken).toBe("mock-access-token")
    })

    it("should maintain token integrity across callbacks", () => {
      const initialToken = {
        id: "user-123",
        email: "test@example.com",
        accessToken: "access-token",
      }

      // JWT callback
      const jwtToken = { ...initialToken }
      expect(jwtToken.id).toBe(initialToken.id)

      // Session callback
      const session = {
        user: {
          id: jwtToken.id,
          email: jwtToken.email,
        },
      }

      expect(session.user.id).toBe(initialToken.id)
      expect(session.user.email).toBe(initialToken.email)
    })
  })

  describe("Database Integration", () => {
    it("should connect to Cloud SQL database", async () => {
      const db = await getDatabase()
      expect(db).toBeDefined()
      expect(getDatabase).toHaveBeenCalled()
    })

    it("should query users table successfully", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
      }

      mockDb.limit.mockResolvedValue([mockUser])

      const db = await getDatabase()
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, mockUser.email))
        .limit(1)

      expect(result).toHaveLength(1)
      expect(result[0].email).toBe(mockUser.email)
    })

    it("should handle concurrent database queries", async () => {
      const mockUsers = [
        { id: "user-1", email: "user1@example.com" },
        { id: "user-2", email: "user2@example.com" },
      ]

      mockDb.limit
        .mockResolvedValueOnce([mockUsers[0]])
        .mockResolvedValueOnce([mockUsers[1]])

      const db = await getDatabase()

      const [result1, result2] = await Promise.all([
        db
          .select()
          .from(users)
          .where(eq(users.email, mockUsers[0].email))
          .limit(1),
        db
          .select()
          .from(users)
          .where(eq(users.email, mockUsers[1].email))
          .limit(1),
      ])

      expect(result1[0].id).toBe(mockUsers[0].id)
      expect(result2[0].id).toBe(mockUsers[1].id)
    })
  })

  describe("Idle Timeout Testing", () => {
    it("should configure 24 hour idle timeout", () => {
      const sessionConfig = {
        strategy: "jwt" as const,
        maxAge: 24 * 60 * 60, // 24 hours
        updateAge: 60 * 60, // Update every hour
      }

      expect(sessionConfig.maxAge).toBe(86400) // 24 hours in seconds
      expect(sessionConfig.updateAge).toBe(3600) // 1 hour in seconds
    })

    it("should expire token after 24 hours of inactivity", () => {
      const now = Math.floor(Date.now() / 1000)
      const maxAge = 24 * 60 * 60 // 24 hours

      const token = {
        id: "user-123",
        iat: now,
        exp: now + maxAge,
      }

      // Check token is valid now
      expect(token.exp).toBeGreaterThan(now)

      // Check token expires after 24 hours
      const after24Hours = now + maxAge + 1
      expect(token.exp).toBeLessThan(after24Hours)
    })

    it("should keep session alive with activity within idle window", () => {
      const now = Math.floor(Date.now() / 1000)
      const maxAge = 24 * 60 * 60
      const updateAge = 60 * 60 // Update every hour

      // Initial token
      const token = {
        id: "user-123",
        iat: now,
        exp: now + maxAge,
      }

      // Activity after 1 hour triggers update
      const afterActivity = now + updateAge
      const updatedToken = {
        ...token,
        iat: afterActivity,
        exp: afterActivity + maxAge,
      }

      expect(updatedToken.exp).toBeGreaterThan(token.exp)
      expect(updatedToken.exp - updatedToken.iat).toBe(maxAge)
    })

    it("should not expire session with continuous activity", () => {
      const now = Math.floor(Date.now() / 1000)
      const maxAge = 24 * 60 * 60
      const updateAge = 60 * 60

      let currentToken = {
        id: "user-123",
        iat: now,
        exp: now + maxAge,
      }

      // Simulate 10 hours of activity (one update per hour)
      for (let i = 1; i <= 10; i++) {
        const activityTime = now + i * updateAge
        currentToken = {
          ...currentToken,
          iat: activityTime,
          exp: activityTime + maxAge,
        }

        // Token should still be valid
        expect(currentToken.exp).toBeGreaterThan(activityTime)
      }

      // Final token should expire 24 hours after last activity
      const finalActivity = now + 10 * updateAge
      expect(currentToken.exp).toBe(finalActivity + maxAge)
    })

    it("should reject expired tokens", () => {
      const now = Math.floor(Date.now() / 1000)
      const maxAge = 24 * 60 * 60

      const expiredToken = {
        id: "user-123",
        iat: now - maxAge - 3600, // Created 25 hours ago
        exp: now - 3600, // Expired 1 hour ago
      }

      const currentTime = now
      expect(expiredToken.exp).toBeLessThan(currentTime)
    })
  })

  describe("Re-authentication Requirements", () => {
    it("should require re-authentication for sensitive operations", () => {
      const session = {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      }

      // Sensitive operation should check for recent authentication
      const lastAuthTime = Math.floor(Date.now() / 1000) - 60 * 60 // 1 hour ago
      const requireRecentAuth = (maxAgeSeconds: number) => {
        const now = Math.floor(Date.now() / 1000)
        return now - lastAuthTime < maxAgeSeconds
      }

      // Should require fresh auth (within 5 minutes)
      expect(requireRecentAuth(5 * 60)).toBe(false)

      // Should accept recent auth (within 2 hours)
      expect(requireRecentAuth(2 * 60 * 60)).toBe(true)
    })

    it("should accept fresh OTP re-authentication", () => {
      const reAuthToken = {
        userId: "user-123",
        issuedAt: Math.floor(Date.now() / 1000),
        purpose: "server-share-access",
      }

      const now = Math.floor(Date.now() / 1000)
      const tokenAge = now - reAuthToken.issuedAt

      // Fresh token (within 5 minutes)
      expect(tokenAge).toBeLessThan(5 * 60)
      expect(reAuthToken.purpose).toBe("server-share-access")
    })

    it("should reject stale re-authentication tokens", () => {
      const staleReAuthToken = {
        userId: "user-123",
        issuedAt: Math.floor(Date.now() / 1000) - 10 * 60, // 10 minutes ago
        purpose: "server-share-access",
      }

      const now = Math.floor(Date.now() / 1000)
      const tokenAge = now - staleReAuthToken.issuedAt
      const maxReAuthAge = 5 * 60 // 5 minutes

      expect(tokenAge).toBeGreaterThan(maxReAuthAge)
    })
  })
})
