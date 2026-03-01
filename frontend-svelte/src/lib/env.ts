/**
 * Environment variables re-exported for shared use
 *
 * SvelteKit adaptation — uses process.env for server-side access.
 * Public env vars use PUBLIC_ prefix (SvelteKit convention).
 * Falls back to NEXT_PUBLIC_* for backward compatibility with env config.
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

const SITE_URL = getEnvVar("PUBLIC_SITE_URL", false) || getEnvVar("NEXT_PUBLIC_SITE_URL", false)
const AUTH_SECRET = getEnvVar("AUTH_SECRET", false) || getEnvVar("NEXTAUTH_SECRET", false)
const GOOGLE_CLIENT_ID = getEnvVar("GOOGLE_CLIENT_ID", false)
const GOOGLE_CLIENT_SECRET = getEnvVar("GOOGLE_CLIENT_SECRET", false)
const SUPPORT_EMAIL = getEnvVar("PUBLIC_SUPPORT_EMAIL", false) || getEnvVar("NEXT_PUBLIC_SUPPORT_EMAIL", false) || "support@keyfate.com"
const COMPANY = getEnvVar("PUBLIC_COMPANY", false) || getEnvVar("NEXT_PUBLIC_COMPANY", false)
const PARENT_COMPANY = getEnvVar("PUBLIC_PARENT_COMPANY", false) || getEnvVar("NEXT_PUBLIC_PARENT_COMPANY", false)
const STRIPE_PUBLISHABLE_KEY = getEnvVar("PUBLIC_STRIPE_PUBLISHABLE_KEY", false) || getEnvVar("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", false)

// Backward-compatible aliases (deprecated — use the new names)
/** @deprecated Use SITE_URL */
const NEXT_PUBLIC_SITE_URL = SITE_URL
/** @deprecated Use AUTH_SECRET */
const NEXTAUTH_SECRET = AUTH_SECRET
/** @deprecated Use SUPPORT_EMAIL */
const NEXT_PUBLIC_SUPPORT_EMAIL = SUPPORT_EMAIL
/** @deprecated Use COMPANY */
const NEXT_PUBLIC_COMPANY = COMPANY
/** @deprecated Use PARENT_COMPANY */
const NEXT_PUBLIC_PARENT_COMPANY = PARENT_COMPANY
/** @deprecated Use STRIPE_PUBLISHABLE_KEY */
const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = STRIPE_PUBLISHABLE_KEY

export {
  // New canonical names
  AUTH_SECRET,
  COMPANY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  PARENT_COMPANY,
  SITE_URL,
  STRIPE_PUBLISHABLE_KEY,
  SUPPORT_EMAIL,
  // Deprecated aliases for backward compatibility
  NEXT_PUBLIC_COMPANY,
  NEXT_PUBLIC_PARENT_COMPANY,
  NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXTAUTH_SECRET,
}
