/**
 * Auth configuration for SvelteKit (Auth.js / @auth/sveltekit)
 *
 * The primary auth setup lives in src/auth.ts (SvelteKitAuth handle).
 * This module re-exports session helpers for use in API routes and
 * server load functions, and provides the authConfig object that
 * other modules may reference.
 */

export { getSession, requireSession } from "$lib/server/auth"

/**
 * Auth configuration constants.
 * These mirror the values used in src/auth.ts for reference.
 */
export const authConfig = {
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
} as const
