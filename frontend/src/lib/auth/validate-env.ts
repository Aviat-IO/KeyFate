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
      "[Auth Environment] Missing required environment variables:",
      missing,
    )
  }

  // Log configuration (without secrets) - only in development or when DEBUG_AUTH is enabled
  const shouldLog =
    process.env.NODE_ENV === "development" || process.env.DEBUG_AUTH === "true"

  if (shouldLog) {
    console.log("[Auth Environment] Configuration:", {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NODE_ENV: process.env.NODE_ENV,
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      isProduction: process.env.NODE_ENV === "production",
      isSecureUrl: process.env.NEXTAUTH_URL?.startsWith("https://"),
    })

    // Validate URL format
    if (process.env.NEXTAUTH_URL) {
      try {
        const url = new URL(process.env.NEXTAUTH_URL)
        console.log("[Auth Environment] URL parsed successfully:", {
          protocol: url.protocol,
          hostname: url.hostname,
          pathname: url.pathname,
        })
      } catch {
        console.error(
          "[Auth Environment] Invalid NEXTAUTH_URL format:",
          process.env.NEXTAUTH_URL,
        )
      }
    }
  } else if (process.env.NEXTAUTH_URL) {
    // Still validate URL format silently in production
    try {
      new URL(process.env.NEXTAUTH_URL)
    } catch {
      console.error(
        "[Auth Environment] Invalid NEXTAUTH_URL format:",
        process.env.NEXTAUTH_URL,
      )
    }
  }

  // Check for common issues
  if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXTAUTH_URL?.startsWith("https://")) {
      console.warn(
        "[Auth Environment] WARNING: Using non-HTTPS URL in production",
      )
    }

    if (
      !process.env.NEXTAUTH_SECRET ||
      process.env.NEXTAUTH_SECRET.length < 32
    ) {
      console.warn(
        "[Auth Environment] WARNING: NEXTAUTH_SECRET should be at least 32 characters",
      )
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
