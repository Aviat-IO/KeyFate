/**
 * Production-specific NextAuth configuration helpers
 * Ensures proper cookie and callback handling in production environments
 */

import type { NextAuthOptions } from "next-auth";

/**
 * Get the base URL for callbacks, ensuring it works in all environments
 */
export function getBaseUrl(): string {
  // In production/staging, use NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // In development, use localhost
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // Fallback for edge cases
  return "https://staging.keyfate.com";
}

/**
 * Determine if we should use secure cookies
 */
export function shouldUseSecureCookies(): boolean {
  const url = getBaseUrl();
  return url.startsWith("https://");
}

/**
 * Get cookie configuration for NextAuth
 * This ensures cookies work properly in production with HTTPS
 */
export function getCookieConfig() {
  const isSecure = shouldUseSecureCookies();
  const isProduction = process.env.NODE_ENV === "production";

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
    };
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
  };
}

/**
 * Merge production configuration with base auth config
 */
export function withProductionConfig(baseConfig: NextAuthOptions): NextAuthOptions {
  const baseUrl = getBaseUrl();
  const isSecure = shouldUseSecureCookies();

  return {
    ...baseConfig,
    // Ensure cookies are properly configured for production
    cookies: getCookieConfig(),
    // Use secure cookies in production
    useSecureCookies: isSecure,
    // Trust the host header in production (important for Cloud Run)
    trustHost: true,
    // Debug only in development
    debug: process.env.NODE_ENV === "development",
  };
}