import { describe, expect, it, vi } from "vitest"
import { clearAuthCookies } from "@/lib/cookies"

describe("Cookie Management", () => {
  describe("clearAuthCookies", () => {
    it("should clear legacy auth cookies", () => {
      const mockRequestCookies = {
        getAll: vi.fn().mockReturnValue([
          { name: "sb-auth-token", value: "token123" },
          { name: "supabase-session", value: "session456" },
          { name: "__stripe_mid", value: "stripe789" },
          { name: "__stripe_sid", value: "stripe012" },
          { name: "regular-cookie", value: "value" },
        ]),
      }

      const mockResponseCookies = {
        delete: vi.fn(),
        set: vi.fn(),
      }

      clearAuthCookies({
        requestCookies: mockRequestCookies as any,
        responseCookies: mockResponseCookies as any,
        domain: "example.com",
      })

      // Should call getAll to retrieve cookies
      expect(mockRequestCookies.getAll).toHaveBeenCalled()

      // Should delete Supabase cookies
      expect(mockResponseCookies.delete).toHaveBeenCalledWith("sb-auth-token")
      expect(mockResponseCookies.delete).toHaveBeenCalledWith(
        "supabase-session",
      )
      expect(mockResponseCookies.delete).toHaveBeenCalledWith("__stripe_mid")
      expect(mockResponseCookies.delete).toHaveBeenCalledWith("__stripe_sid")

      // Should not delete regular cookies
      expect(mockResponseCookies.delete).not.toHaveBeenCalledWith(
        "regular-cookie",
      )

      // Should set expired cookies
      expect(mockResponseCookies.set).toHaveBeenCalledWith(
        "sb-auth-token",
        "",
        {
          expires: new Date(0),
          path: "/",
          domain: "example.com",
        },
      )
      expect(mockResponseCookies.set).toHaveBeenCalledWith(
        "supabase-session",
        "",
        {
          expires: new Date(0),
          path: "/",
          domain: "example.com",
        },
      )
    })

    it("should handle empty cookie list", () => {
      const mockRequestCookies = {
        getAll: vi.fn().mockReturnValue([]),
      }

      const mockResponseCookies = {
        delete: vi.fn(),
        set: vi.fn(),
      }

      clearAuthCookies({
        requestCookies: mockRequestCookies as any,
        responseCookies: mockResponseCookies as any,
        domain: "example.com",
      })

      expect(mockRequestCookies.getAll).toHaveBeenCalled()
      expect(mockResponseCookies.delete).not.toHaveBeenCalled()
      expect(mockResponseCookies.set).not.toHaveBeenCalled()
    })

    it("should only clear cookies with specific prefixes", () => {
      const mockRequestCookies = {
        getAll: vi.fn().mockReturnValue([
          { name: "sb-test", value: "value1" },
          { name: "supabase-test", value: "value2" },
          { name: "other-cookie", value: "value3" },
          { name: "sb", value: "value4" }, // Edge case: exact match
        ]),
      }

      const mockResponseCookies = {
        delete: vi.fn(),
        set: vi.fn(),
      }

      clearAuthCookies({
        requestCookies: mockRequestCookies as any,
        responseCookies: mockResponseCookies as any,
        domain: "test.com",
      })

      // Should clear cookies with correct prefixes
      expect(mockResponseCookies.delete).toHaveBeenCalledWith("sb-test")
      expect(mockResponseCookies.delete).toHaveBeenCalledWith("supabase-test")

      // Should not clear other cookies
      expect(mockResponseCookies.delete).not.toHaveBeenCalledWith(
        "other-cookie",
      )
      expect(mockResponseCookies.delete).not.toHaveBeenCalledWith("sb")
    })
  })
})
