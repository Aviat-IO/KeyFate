import { NextRequest, NextResponse } from "next/server"
// import { updateSession } from '@/utils/supabase/middleware'
// import type { User } from '@supabase/supabase-js'

// Routes that don't require email verification
const NON_VERIFICATION_REQUIRED_ROUTES = [
  /^\/auth\/login$/,
  /^\/auth\/signup$/,
  /^\/auth\/reset-password$/,
  /^\/auth\/verify-email$/,
  /^\/auth\/verify$/,
  /^\/auth\/callback$/,
  /^\/auth\/signout$/,
  /^\/$/,
  /^\/api\/auth\/.*$/,
]

/**
 * Check if a route requires email verification
 */
function requiresEmailVerification(pathname: string): boolean {
  return !NON_VERIFICATION_REQUIRED_ROUTES.some((regex) => regex.test(pathname))
}

/**
 * Email verification middleware
 * Redirects unverified users to verification page for protected routes
 * TODO: Implement with NextAuth middleware
 */
export async function checkEmailVerificationMiddleware(request: NextRequest) {
  try {
    // TODO: Replace with NextAuth middleware logic
    console.warn(
      "[Email Verification] checkEmailVerificationMiddleware is deprecated - use NextAuth middleware",
    )

    const pathname = request.nextUrl.pathname

    // If route doesn't require verification, allow through
    if (!requiresEmailVerification(pathname)) {
      return NextResponse.next()
    }

    // For now, allow all requests through since we're migrating to NextAuth
    return NextResponse.next()
  } catch (error) {
    console.error("[EmailVerification] Middleware error:", error)
    // On error, allow through to avoid breaking the app
    return NextResponse.next()
  }
}

/**
 * Combined middleware function that handles both auth and email verification
 */
export async function authAndEmailVerificationMiddleware(request: NextRequest) {
  // First run the email verification check
  return checkEmailVerificationMiddleware(request)
}
