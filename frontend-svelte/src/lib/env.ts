/**
 * Environment variables re-exported for shared use
 *
 * SvelteKit adaptation of the Next.js env.ts module.
 * Uses process.env for server-side access (works with Node adapter).
 *
 * Note: In SvelteKit, public env vars use PUBLIC_ prefix instead of NEXT_PUBLIC_.
 * This module provides backward-compatible exports for code that references
 * the old NEXT_PUBLIC_* names.
 */

// Helper function to safely get environment variable
function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name]

  if (!value && required) {
    // Only throw on server side when variable is missing
    if (typeof window === "undefined") {
      throw new Error(`${name} is not set`)
    }
    return ""
  }

  return value || ""
}

// Re-export with original names for backward compatibility
// These map NEXT_PUBLIC_* -> PUBLIC_* env vars
const NEXT_PUBLIC_SITE_URL = getEnvVar("PUBLIC_SITE_URL", false) || getEnvVar("NEXT_PUBLIC_SITE_URL", false)
const NEXTAUTH_SECRET = getEnvVar("NEXTAUTH_SECRET", false) || getEnvVar("AUTH_SECRET", false)
const GOOGLE_CLIENT_ID = getEnvVar("GOOGLE_CLIENT_ID", false)
const GOOGLE_CLIENT_SECRET = getEnvVar("GOOGLE_CLIENT_SECRET", false)
const NEXT_PUBLIC_SUPPORT_EMAIL = getEnvVar("PUBLIC_SUPPORT_EMAIL", false) || getEnvVar("NEXT_PUBLIC_SUPPORT_EMAIL", false) || "support@keyfate.com"
const NEXT_PUBLIC_COMPANY = getEnvVar("PUBLIC_COMPANY", false) || getEnvVar("NEXT_PUBLIC_COMPANY", false)
const NEXT_PUBLIC_PARENT_COMPANY = getEnvVar("PUBLIC_PARENT_COMPANY", false) || getEnvVar("NEXT_PUBLIC_PARENT_COMPANY", false)
const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = getEnvVar("PUBLIC_STRIPE_PUBLISHABLE_KEY", false) || getEnvVar("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", false)

export {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  NEXT_PUBLIC_COMPANY,
  NEXT_PUBLIC_PARENT_COMPANY,
  NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXTAUTH_SECRET,
}
