import { redirect, type Handle } from "@sveltejs/kit"
import { sequence } from "@sveltejs/kit/hooks"
import { handle as authHandle } from "./auth"

/**
 * Middleware handle: HTTPS enforcement, request ID, email verification redirect,
 * and authenticated-user redirect away from sign-in.
 *
 * Ported from frontend/src/middleware.ts (Next.js withAuth middleware).
 */
const middlewareHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url

  // --- HTTPS enforcement in production ---
  if (process.env.NODE_ENV === "production") {
    const proto = event.request.headers.get("x-forwarded-proto")
    if (proto && proto !== "https") {
      const url = new URL(event.url)
      url.protocol = "https:"
      throw redirect(301, url.toString())
    }
  }

  // --- Generate unique request ID for tracing ---
  const requestId = crypto.randomUUID()
  event.request.headers.set("x-request-id", requestId)

  // --- Session-dependent middleware ---
  const session = await event.locals.auth()

  // Redirect authenticated users away from sign-in pages to dashboard
  if (
    session?.user &&
    (pathname === "/sign-in" ||
      pathname === "/auth/signin" ||
      pathname === "/login")
  ) {
    throw redirect(303, "/dashboard")
  }

  // Email verification enforcement for authenticated users
  if (session?.user) {
    const verificationExemptRoutes = [
      "/auth/verify-email",
      "/auth/verify-email-nextauth",
      "/api/auth/verify-email",
      "/api/auth/verify-email-nextauth",
      "/api/auth/resend-verification",
      "/api/auth/verification-status",
      "/auth/signin",
      "/sign-in",
      "/sign-up",
      "/auth/error",
      "/check-in",
      "/api/check-in",
      "/api/auth", // Auth.js API routes
    ]

    const isVerificationExempt = verificationExemptRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )

    const emailVerified = (session.user as any).emailVerified
    if (!emailVerified && !isVerificationExempt) {
      throw redirect(303, "/auth/verify-email")
    }
  }

  // Resolve the request and attach request ID to response
  const response = await resolve(event)
  response.headers.set("x-request-id", requestId)
  return response
}

// Auth handle first (populates event.locals.auth), then our middleware
export const handle: Handle = sequence(authHandle, middlewareHandle)
