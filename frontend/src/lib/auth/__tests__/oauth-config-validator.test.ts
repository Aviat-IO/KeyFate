import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  validateOAuthConfig,
  assertValidOAuthConfig,
  getCurrentOAuthConfig,
  isOAuthConfigured,
  type OAuthConfig,
} from "../oauth-config-validator"

describe("OAuth Config Validator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("validateOAuthConfig", () => {
    it("should validate complete valid configuration", () => {
      const config: OAuthConfig = {
        googleClientId: "test-client-id.apps.googleusercontent.com",
        googleClientSecret: "valid-client-secret-123456789",
        nextAuthSecret: "secure-nextauth-secret-with-sufficient-length",
        nextAuthUrl: "https://example.com",
      }

      const result = validateOAuthConfig(config)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should detect missing required fields when explicitly undefined", () => {
      const config: OAuthConfig = {
        googleClientId: undefined,
        googleClientSecret: undefined,
        nextAuthSecret: undefined,
        nextAuthUrl: undefined,
      }

      const result = validateOAuthConfig(config)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        "GOOGLE_CLIENT_ID is required for Google OAuth",
      )
      expect(result.errors).toContain(
        "GOOGLE_CLIENT_SECRET is required for Google OAuth",
      )
      expect(result.errors).toContain(
        "NEXTAUTH_SECRET is required for NextAuth",
      )
      expect(result.errors).toContain("NEXTAUTH_URL is required for NextAuth")
    })

    it("should validate environment variables when no config provided", () => {
      // This test validates that the environment variables we set in vitest.config.mts work
      const result = validateOAuthConfig()

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should validate Google Client ID format", () => {
      const config: OAuthConfig = {
        googleClientId: "invalid-client-id",
        googleClientSecret: "valid-secret",
        nextAuthSecret: "valid-secret-123456789012345678901234567890",
        nextAuthUrl: "https://example.com",
      }

      const result = validateOAuthConfig(config)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        "GOOGLE_CLIENT_ID must be a valid Google OAuth client ID ending with .apps.googleusercontent.com",
      )
    })

    it("should validate NextAuth URL format", () => {
      const config: OAuthConfig = {
        googleClientId: "test-client.apps.googleusercontent.com",
        googleClientSecret: "valid-secret",
        nextAuthSecret: "valid-secret-123456789012345678901234567890",
        nextAuthUrl: "invalid-url",
      }

      const result = validateOAuthConfig(config)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        "NEXTAUTH_URL must be a valid URL starting with http:// or https://",
      )
    })

    it("should warn about default values", () => {
      const config: OAuthConfig = {
        googleClientId: "test-client.apps.googleusercontent.com",
        googleClientSecret: "valid-secret",
        nextAuthSecret: "your-nextauth-secret-here",
        nextAuthUrl: "https://example.com",
      }

      const result = validateOAuthConfig(config)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain(
        "NEXTAUTH_SECRET should be changed from the default value",
      )
    })

    it("should warn about short secrets", () => {
      const config: OAuthConfig = {
        googleClientId: "test-client.apps.googleusercontent.com",
        googleClientSecret: "short",
        nextAuthSecret: "short",
        nextAuthUrl: "https://example.com",
      }

      const result = validateOAuthConfig(config)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain(
        "GOOGLE_CLIENT_SECRET seems too short, verify it is correct",
      )
      expect(result.warnings).toContain(
        "NEXTAUTH_SECRET should be at least 32 characters long for security",
      )
    })
  })

  describe("assertValidOAuthConfig", () => {
    it("should not throw for valid configuration", () => {
      const config: OAuthConfig = {
        googleClientId: "test-client.apps.googleusercontent.com",
        googleClientSecret: "valid-secret-123456789",
        nextAuthSecret: "secure-nextauth-secret-with-sufficient-length",
        nextAuthUrl: "https://example.com",
      }

      expect(() => assertValidOAuthConfig(config)).not.toThrow()
    })

    it("should throw for invalid configuration", () => {
      const config: OAuthConfig = {
        googleClientId: "invalid-id",
      }

      expect(() => assertValidOAuthConfig(config)).toThrow(
        "OAuth configuration invalid:",
      )
    })
  })

  describe("getCurrentOAuthConfig", () => {
    it("should return current environment configuration", () => {
      const config = getCurrentOAuthConfig()

      expect(config).toHaveProperty("googleClientId")
      expect(config).toHaveProperty("googleClientSecret")
      expect(config).toHaveProperty("nextAuthSecret")
      expect(config).toHaveProperty("nextAuthUrl")
    })
  })

  describe("isOAuthConfigured", () => {
    it("should return true when OAuth is properly configured", () => {
      // This test depends on the test environment configuration
      const result = isOAuthConfigured()

      // Should be true since we configured test environment variables
      expect(result).toBe(true)
    })
  })
})
