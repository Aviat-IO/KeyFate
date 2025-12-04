import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  requireEmailVerification,
  getVerifiedSession,
} from "@/lib/auth/verification"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"

// Mock both next-auth/next and next-auth to handle different imports
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth-config", () => ({
  authConfig: {},
}))

const mockGetServerSession = vi.mocked(getServerSession)

describe("Email Verification Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("requireEmailVerification", () => {
    it("should return 401 if no session exists", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const result = await requireEmailVerification()

      expect(result).toBeInstanceOf(NextResponse)
      const json = await result?.json()
      expect(json.error).toBe("Unauthorized")
      expect(result?.status).toBe(401)
    })

    it("should return 403 if email not verified", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: null,
        },
      } as any)

      const result = await requireEmailVerification()

      expect(result).toBeInstanceOf(NextResponse)
      const json = await result?.json()
      expect(json.error).toBe("Email verification required")
      expect(json.code).toBe("EMAIL_NOT_VERIFIED")
      expect(result?.status).toBe(403)
    })

    it("should return null if email is verified", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: new Date(),
        },
      } as any)

      const result = await requireEmailVerification()

      expect(result).toBeNull()
    })

    it("should return 401 if user object missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: null,
      } as any)

      const result = await requireEmailVerification()

      expect(result).toBeInstanceOf(NextResponse)
      const json = await result?.json()
      expect(json.error).toBe("Unauthorized")
      expect(result?.status).toBe(401)
    })
  })

  describe("getVerifiedSession", () => {
    it("should return null if no session exists", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const result = await getVerifiedSession()

      expect(result).toBeNull()
    })

    it("should return null if email not verified", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: null,
        },
      } as any)

      const result = await getVerifiedSession()

      expect(result).toBeNull()
    })

    it("should return session if email is verified", async () => {
      const mockSession = {
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: new Date(),
        },
      }
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const result = await getVerifiedSession()

      expect(result).toEqual(mockSession)
    })

    it("should return null if user object missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: null,
      } as any)

      const result = await getVerifiedSession()

      expect(result).toBeNull()
    })

    it("should return null if user object is undefined", async () => {
      mockGetServerSession.mockResolvedValue({} as any)

      const result = await getVerifiedSession()

      expect(result).toBeNull()
    })
  })

  describe("API Endpoint Integration", () => {
    it("should block secret creation for unverified users", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: null,
        },
      } as any)

      const verificationError = await requireEmailVerification()

      expect(verificationError).not.toBeNull()
      const json = await verificationError?.json()
      expect(json.code).toBe("EMAIL_NOT_VERIFIED")
    })

    it("should allow secret creation for verified users", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: new Date(),
        },
      } as any)

      const verificationError = await requireEmailVerification()

      expect(verificationError).toBeNull()
    })

    it("should provide clear error code for frontend handling", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: null,
        },
      } as any)

      const result = await requireEmailVerification()
      expect(result).not.toBeNull()
      const json = await result?.json()

      expect(json).toHaveProperty("error")
      expect(json).toHaveProperty("code")
      expect(json.code).toBe("EMAIL_NOT_VERIFIED")
    })
  })

  describe("Security Guarantees", () => {
    it("should not leak user information in error messages", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: null,
        },
      } as any)

      const result = await requireEmailVerification()
      const json = await result?.json()

      expect(json.error).not.toContain("test@example.com")
      expect(json.error).not.toContain("123")
      expect(json).not.toHaveProperty("userId")
      expect(json).not.toHaveProperty("email")
    })

    it("should enforce verification before any sensitive operations", async () => {
      const unverifiedSession = {
        user: {
          id: "123",
          email: "test@example.com",
          emailVerified: null,
        },
      }
      mockGetServerSession.mockResolvedValue(unverifiedSession as any)

      const verificationResult = await requireEmailVerification()
      const verifiedSession = await getVerifiedSession()

      expect(verificationResult).not.toBeNull()
      expect(verifiedSession).toBeNull()
    })

    it("should handle missing emailVerified field as unverified", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
        },
      } as any)

      const result = await requireEmailVerification()

      expect(result).not.toBeNull()
      const json = await result?.json()
      expect(json.code).toBe("EMAIL_NOT_VERIFIED")
    })
  })
})
