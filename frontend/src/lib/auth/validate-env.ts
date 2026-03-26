/**
 * Validate environment variables for Auth.js in production
 * This helps debug configuration issues
 *
 * SvelteKit uses PUBLIC_SITE_URL (via SITE_URL from $lib/env) instead of NEXTAUTH_URL.
 */

export function validateAuthEnvironment() {
  const required = {
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error(
      "[Auth] Missing required environment variables:",
      missing,
    )
  }

  // Validate URL format
  const siteUrl = required.PUBLIC_SITE_URL
  if (siteUrl) {
    try {
      new URL(siteUrl)
    } catch {
      console.error(
        "[Auth] Invalid PUBLIC_SITE_URL format",
      )
    }
  }

  // Check for common issues
  if (process.env.NODE_ENV === "production") {
    if (siteUrl && !siteUrl.startsWith("https://")) {
      console.error("[Auth] Non-HTTPS URL in production")
    }

    const authSecret = required.AUTH_SECRET
    if (
      !authSecret ||
      authSecret.length < 32
    ) {
      console.error("[Auth] AUTH_SECRET too short")
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
  }
}

// Run validation on module load
if (typeof window === "undefined") {
  validateAuthEnvironment()
}
