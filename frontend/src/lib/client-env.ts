/**
 * Client-safe environment variables
 *
 * IMPORTANT: Only NEXT_PUBLIC_* variables should be accessed here.
 * Never import server-env.ts in client-side code.
 */

export const clientEnv = {
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@keyfate.com",
} as const

// Validate that required public env vars are set
if (typeof window !== "undefined") {
  if (!clientEnv.STRIPE_PUBLISHABLE_KEY) {
    console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set")
  }
}
