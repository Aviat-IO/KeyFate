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

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === "production") {
      const proto = request.headers.get("x-forwarded-proto")
      if (proto && proto !== "https") {
        const url = request.nextUrl.clone()
        url.protocol = "https:"
        return NextResponse.redirect(url, 301)
      }
    }

    // Generate unique request ID for tracing (using Web Crypto API for Edge runtime)
    const requestId = crypto.randomUUID()
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-request-id", requestId)

    // Routes that don't require email verification
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
      "/check-in", // Token-based authentication, not session-based
      "/api/check-in", // API endpoint also uses token-based auth
    ]

    // If user is authenticated and trying to access sign-in page, redirect to dashboard
    if (token && (pathname === "/sign-in" || pathname === "/auth/signin")) {
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
        const response = NextResponse.redirect(url)
        response.headers.set("x-request-id", requestId)
        return response
      }
    }

    // Allow the request to continue with request ID in response headers
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    response.headers.set("x-request-id", requestId)
    return response
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
          "/auth/signin",
          "/sign-in",
          "/sign-up",
          "/auth/verify-email",
          "/auth/forgot-password",
          "/auth/reset-password",
          "/check-in", // Allow unauthenticated access for token-based check-ins
          "/decrypt", // Allow unauthenticated access for decrypting shares
          "/pricing",
          "/terms-of-service",
          "/privacy-policy",
          "/blog", // Public blog pages
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
      signIn: "/auth/signin",
      error: "/auth/signin",
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
     * - img (public images)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|img|public).*)",
  ],
}
