import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { requireRecentAuthentication } from "@/lib/auth/re-authentication"
import { NextRequest } from "next/server"
import * as authModule from "@/lib/auth-config"
import * as otpModule from "@/lib/auth/otp"

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

describe("Re-Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("requireRecentAuthentication", () => {
    it("should reject requests without session", async () => {
      const { getServerSession } = await import("next-auth/next")
      vi.mocked(getServerSession).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/test")
      const result = await requireRecentAuthentication(request)

      expect(result.valid).toBe(false)
      expect(result.error).toContain("Authentication required")
    })

    it("should reject requests without re-auth token", async () => {
      const { getServerSession } = await import("next-auth/next")
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const request = new NextRequest("http://localhost:3000/test")
      const result = await requireRecentAuthentication(request)

      expect(result.valid).toBe(false)
      expect(result.error).toContain("Re-authentication required")
      expect(result.userId).toBe("test-user-id")
    })

    it("should reject requests with invalid OTP token", async () => {
      const { getServerSession } = await import("next-auth/next")
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      vi.spyOn(otpModule, "validateOTPToken").mockResolvedValue({
        success: true,
        valid: false,
      })

      const request = new NextRequest("http://localhost:3000/test", {
        headers: {
          "x-reauth-token": "12345678",
        },
      })
      const result = await requireRecentAuthentication(request)

      expect(result.valid).toBe(false)
      expect(result.error).toContain("Invalid or expired")
    })

    it("should accept requests with valid OTP token", async () => {
      const { getServerSession } = await import("next-auth/next")
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      vi.spyOn(otpModule, "validateOTPToken").mockResolvedValue({
        success: true,
        valid: true,
      })

      const request = new NextRequest("http://localhost:3000/test", {
        headers: {
          "x-reauth-token": "12345678",
        },
      })
      const result = await requireRecentAuthentication(request)

      expect(result.valid).toBe(true)
      expect(result.userId).toBe("test-user-id")
    })

    it("should reject requests without user email", async () => {
      const { getServerSession } = await import("next-auth/next")
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: "test-user-id",
          name: "Test User",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const request = new NextRequest("http://localhost:3000/test", {
        headers: {
          "x-reauth-token": "12345678",
        },
      })
      const result = await requireRecentAuthentication(request)

      expect(result.valid).toBe(false)
      expect(result.error).toContain("Email not found")
    })
  })

  describe("Server Share Reveal Endpoint", () => {
    it("should require re-authentication for server share access", async () => {
      const response = await fetch(
        "http://localhost:3000/api/secrets/test-id/reveal-server-share",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Host: "localhost:3000",
            // No x-reauth-token header
          },
        },
      )

      // Should get 403 with REAUTH_REQUIRED code
      expect([401, 403]).toContain(response.status)
      const data = await response.json()

      // Either unauthorized or re-auth required
      if (response.status === 403) {
        expect(data.code || data.error).toMatch(/REAUTH|re-authentication/i)
      }
    })
  })
})
