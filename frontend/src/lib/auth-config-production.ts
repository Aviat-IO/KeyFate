/**
 * Production-specific NextAuth configuration helpers
 * Ensures proper cookie and callback handling in production environments
 */

import type { AuthOptions } from "next-auth/core/types"

// Augment AuthOptions to include trustHost
declare module "next-auth/core/types" {
  interface AuthOptions {
    trustHost?: boolean
  }
}

/**
 * Get the base URL for callbacks, ensuring it works in all environments
 */
export function getBaseUrl(): string {
  // In production/staging, use NEXTAUTH_URL
  if (
    process.env.NEXTAUTH_URL &&
    !process.env.NEXTAUTH_URL.includes("0.0.0.0")
  ) {
    return process.env.NEXTAUTH_URL
  }

  // Fallback to NEXT_PUBLIC_SITE_URL
  if (
    process.env.NEXT_PUBLIC_SITE_URL &&
    !process.env.NEXT_PUBLIC_SITE_URL.includes("0.0.0.0")
  ) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // In development, use localhost
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000"
  }

  // Fallback for staging
  return "https://staging.keyfate.com"
}

/**
 * Determine if we should use secure cookies
 */
export function shouldUseSecureCookies(): boolean {
  const url = getBaseUrl()
  return url.startsWith("https://")
}

/**
 * Get cookie configuration for NextAuth
 * This ensures cookies work properly in production with HTTPS
 */
export function getCookieConfig() {
  const isSecure = shouldUseSecureCookies()
  const isProduction = process.env.NODE_ENV === "production"

  // In production with HTTPS, we need specific cookie settings
  if (isSecure) {
    return {
      sessionToken: {
        name: `__Secure-next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          // Ensure the cookie domain matches the deployment domain
          domain: process.env.COOKIE_DOMAIN || undefined,
        },
      },
      callbackUrl: {
        name: `__Secure-next-auth.callback-url`,
        options: {
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: process.env.COOKIE_DOMAIN || undefined,
        },
      },
      csrfToken: {
        name: `__Host-next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
        },
      },
    }
  }

  // Development configuration
  return {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
  }
}

/**
 * Merge production configuration with base auth config
 */
export function withProductionConfig(baseConfig: AuthOptions): AuthOptions {
  const baseUrl = getBaseUrl()
  const isSecure = shouldUseSecureCookies()

  return {
    ...baseConfig,
    cookies: getCookieConfig(),
    useSecureCookies: isSecure,
    // Trust host headers when behind proxies (Cloud Run, etc.)
    trustHost: true,
    debug: process.env.NODE_ENV === "development",
  }
}
