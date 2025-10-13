import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Wrap with NextAuth's withAuth for authentication functionality
export default withAuth(
  async function middleware(
    request: NextRequest & { nextauth: { token: any } },
  ) {
    const { pathname } = request.nextUrl
    const token = request.nextauth.token

    // Routes that don't require email verification
    const verificationExemptRoutes = [
      "/auth/verify-email",
      "/auth/verify-email-nextauth",
      "/api/auth/verify-email",
      "/api/auth/verify-email-nextauth",
      "/api/auth/resend-verification",
      "/api/auth/verification-status",
      "/sign-in",
      "/sign-up",
      "/auth/error",
      "/check-in", // Token-based authentication, not session-based
      "/api/check-in", // API endpoint also uses token-based auth
    ]

    // If user is authenticated and trying to access sign-in page, redirect to dashboard
    if (token && pathname === "/sign-in") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    // Check email verification status for authenticated users
    if (token) {
      const isVerificationExempt = verificationExemptRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      )

      // If email is not verified and not on a verification-exempt route, redirect to verify-email page
      if (!token.emailVerified && !isVerificationExempt) {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/verify-email"
        return NextResponse.redirect(url)
      }
    }

    // Allow the request to continue
    return NextResponse.next()
  },
  {
    callbacks: {
      // The authorized callback is called BEFORE the middleware function above
      // If this returns false, the user will be redirected to the sign-in page
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Public routes that don't require authentication
        const publicRoutes = [
          "/",
          "/sign-in",
          "/sign-up",
          "/auth/verify-email",
          "/check-in", // Allow unauthenticated access for token-based check-ins
          "/pricing",
          "/terms-of-service",
          "/privacy-policy",
        ]

        // Check if the current path is public
        const isPublicRoute = publicRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`),
        )

        // API auth routes should always be accessible
        if (pathname.startsWith("/api/auth")) {
          return true
        }

        // Cron endpoints use Bearer token authentication, not session auth
        if (pathname.startsWith("/api/cron/")) {
          return true
        }

        // Webhook endpoints use signature verification, not session auth
        if (pathname.startsWith("/api/webhooks/")) {
          return true
        }

        // Check-in endpoint uses token-based authentication, not session auth
        if (pathname === "/api/check-in") {
          return true
        }

        // Public routes are always authorized
        if (isPublicRoute) {
          return true
        }

        // Protected routes require a token
        return !!token
      },
    },
    pages: {
      signIn: "/sign-in",
      error: "/auth/error",
    },
    secret: process.env.NEXTAUTH_SECRET,
  },
)

// Configuration for which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
