/**
 * Client-safe environment variables for SvelteKit
 *
 * In SvelteKit, public env vars must be prefixed with PUBLIC_.
 * Uses $env/dynamic/public for runtime access.
 *
 * Mapping from Next.js:
 *   NEXT_PUBLIC_SITE_URL           -> PUBLIC_SITE_URL
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY -> PUBLIC_STRIPE_PUBLISHABLE_KEY
 *   NEXT_PUBLIC_SUPPORT_EMAIL      -> PUBLIC_SUPPORT_EMAIL
 */
import { env } from "$env/dynamic/public"

export const clientEnv = {
  SITE_URL: env.PUBLIC_SITE_URL || "http://localhost:5173",
  STRIPE_PUBLISHABLE_KEY: env.PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  SUPPORT_EMAIL: env.PUBLIC_SUPPORT_EMAIL || "support@keyfate.com",
} as const

// Validate that required public env vars are set
if (typeof window !== "undefined") {
  if (!clientEnv.STRIPE_PUBLISHABLE_KEY) {
    console.warn("PUBLIC_STRIPE_PUBLISHABLE_KEY is not set")
  }
}
