/**
 * Validate environment variables for NextAuth in production
 * This helps debug configuration issues
 */

export function validateAuthEnvironment() {
  const required = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
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
  if (process.env.NEXTAUTH_URL) {
    try {
      new URL(process.env.NEXTAUTH_URL)
    } catch {
      console.error(
        "[Auth] Invalid NEXTAUTH_URL format",
      )
    }
  }

  // Check for common issues
  if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXTAUTH_URL?.startsWith("https://")) {
      console.error("[Auth] Non-HTTPS URL in production")
    }

    if (
      !process.env.NEXTAUTH_SECRET ||
      process.env.NEXTAUTH_SECRET.length < 32
    ) {
      console.error("[Auth] NEXTAUTH_SECRET too short")
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
