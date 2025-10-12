import { describe, it, expect, vi } from "vitest"
import { authConfig } from "../../auth-config"

describe("Auth Configuration", () => {
  it("should have providers configured when OAuth credentials are valid", () => {
    expect(authConfig.providers).toBeDefined()
    expect(Array.isArray(authConfig.providers)).toBe(true)

    // Should have at least one provider (Google OAuth with valid credentials)
    expect(authConfig.providers.length).toBeGreaterThan(0)
  })

  it("should have proper NextAuth configuration", () => {
    expect(authConfig.pages?.signIn).toBe("/sign-in")
    // Error page is now configured to handle errors properly
    expect(authConfig.pages?.error).toBe("/auth/error")
    expect(authConfig.session?.strategy).toBe("jwt")
    expect(authConfig.secret).toBeDefined()
  })

  it("should have proper callback configuration", () => {
    expect(authConfig.callbacks?.signIn).toBeDefined()
    expect(authConfig.callbacks?.session).toBeDefined()
    expect(authConfig.callbacks?.jwt).toBeDefined()
  })

  it("should validate Google OAuth provider is included when credentials are valid", () => {
    const googleProvider = authConfig.providers.find(
      (provider: any) => provider.id === "google",
    )

    // If Google credentials are properly configured, Google provider should be present
    const hasValidGoogleCredentials =
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CLIENT_ID !==
        "your-google-client-id.apps.googleusercontent.com" &&
      process.env.GOOGLE_CLIENT_SECRET !== "your-google-client-secret" &&
      process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")

    if (hasValidGoogleCredentials) {
      expect(googleProvider).toBeDefined()
      expect(googleProvider?.type).toBe("oauth")
    } else {
      expect(googleProvider).toBeUndefined()
    }
  })

  it("should have Credentials provider always available", () => {
    const credentialsProvider = authConfig.providers.find(
      (provider: any) => provider.id === "credentials",
    )

    // Credentials provider should always be available for email+password auth
    expect(credentialsProvider).toBeDefined()
    expect(credentialsProvider?.name).toBe("credentials")
  })
})
