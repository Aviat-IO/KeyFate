// @ts-ignore - NextAuth v4 compatibility issue with TypeScript
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/error",
  "/auth/verify-email",
  "/sign-in",
] as const;

// Routes allowed for unverified users
const VERIFICATION_ALLOWED_ROUTES = [
  "/api/auth/resend-verification",
  "/api/auth/verify-email",
  "/api/auth/verification-status",
] as const;

// Cron routes that require Bearer token authentication instead of user sessions
// These routes are called by Google Cloud Scheduler with Authorization: Bearer <CRON_SECRET>
const CRON_ROUTES = [
  "/api/cron",
] as const;

// Auth-related routes (API and pages)
const AUTH_ROUTES = [
  "/api/auth",
  "/auth",
  "/sign-in",
] as const;

/**
 * Check if a route is public (doesn't require authentication)
 * @param pathname - The pathname to check
 * @returns true if the route is public
 */
function isPublicRoute(pathname: string): boolean {
  // Exact match for public routes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (PUBLIC_ROUTES.includes(pathname as any)) {
    return true;
  }

  // Allow all NextAuth API routes
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }

  return false;
}

/**
 * Check if a route is allowed for unverified users
 * @param pathname - The pathname to check
 * @returns true if the route is allowed for unverified users
 */
function isVerificationAllowedRoute(pathname: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return VERIFICATION_ALLOWED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
}

/**
 * Check if a route is an auth-related route
 * @param pathname - The pathname to check
 * @returns true if the route is auth-related
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a route is a cron route that requires Bearer token authentication
 * @param pathname - The pathname to check
 * @returns true if the route is a cron route
 */
function isCronRoute(pathname: string): boolean {
  return CRON_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Validate Bearer token authentication for cron routes
 * Used by Google Cloud Scheduler to authenticate with cron endpoints
 * @param req - The incoming request
 * @returns true if the request has valid Bearer token authentication
 */
function validateCronAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;
  const isValid = !!cronSecret && token === cronSecret;

  return isValid;
}

/**
 * Creates a redirect response to the login page or JSON response for API routes
 * @param req - The incoming request
 * @param error - Optional error message
 * @returns NextResponse redirect to login or JSON error for API routes
 */
function createLoginRedirect(req: NextRequest, error?: string): NextResponse {
  // For API routes, return JSON response instead of redirect
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: error || "Authentication required",
        code: "UNAUTHENTICATED",
      },
      { status: 401 },
    );
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/sign-in";
  redirectUrl.searchParams.set("callbackUrl", req.nextUrl.href);

  if (error) {
    redirectUrl.searchParams.set("error", error);
  }

  return NextResponse.redirect(redirectUrl);
}

/**
 * Creates a redirect response to the dashboard
 * @param req - The incoming request
 * @returns NextResponse redirect to dashboard
 */
function createDashboardRedirect(req: NextRequest): NextResponse {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/dashboard";
  return NextResponse.redirect(redirectUrl);
}

/**
 * Creates a redirect response to the email verification page or JSON response for API routes
 * @param req - The incoming request
 * @param error - Optional error message
 * @returns NextResponse redirect to email verification or JSON error for API routes
 */
function createEmailVerificationRedirect(
  req: NextRequest,
  error?: string,
): NextResponse {
  // For API routes, return JSON response instead of redirect
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: error || "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
      },
      { status: 403 },
    );
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/auth/verify-email";
  redirectUrl.searchParams.set("callbackUrl", req.nextUrl.href);

  if (error) {
    redirectUrl.searchParams.set("error", error);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Skip middleware for static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  try {
    // Check route classification first
    const isPublic = isPublicRoute(pathname);
    const isCron = isCronRoute(pathname);

    // Handle cron routes with Bearer token authentication
    if (isCron) {
      if (validateCronAuth(req)) {
        return NextResponse.next();
      } else {
        return NextResponse.json(
          {
            error: "Unauthorized",
            code: "INVALID_CRON_TOKEN",
          },
          { status: 401 },
        );
      }
    }

    // Allow public routes without checking authentication
    if (isPublic) {
      return NextResponse.next();
    }

    // For protected routes, check authentication
    let token;
    try {
      // Check for secure cookie in production
      const isProduction = process.env.NEXTAUTH_URL?.startsWith("https://");
      const cookieName = isProduction
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token";

      // Also check for the callback cookie which might be present
      const callbackCookieName = isProduction
        ? "__Secure-next-auth.callback-url"
        : "next-auth.callback-url";

      // Log cookie debugging info in non-production
      if (process.env.NODE_ENV !== "production") {
        const cookies = req.cookies.getAll();
        console.log("[Middleware] Checking cookies:", {
          pathname,
          cookieNames: cookies.map(c => c.name),
          expectedCookie: cookieName,
        });
      }

      token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[Middleware] Token status:", {
          hasToken: !!token,
          pathname,
        });
      }
    } catch (tokenError) {
      // Silent fail - treat as unauthenticated
      token = null;
    }

    // If no token for protected route, redirect to sign-in
    if (!token) {
      // Prevent redirect loop - if already on sign-in, allow access
      if (pathname === "/sign-in") {
        return NextResponse.next();
      }
      return createLoginRedirect(req);
    }

    // User is authenticated
    // If on sign-in page, redirect to dashboard
    if (pathname === "/sign-in") {
      return createDashboardRedirect(req);
    }

    // Allow access to protected route
    return NextResponse.next();
  } catch (error) {
    console.error("[Middleware] Unexpected error:", error);
    // On error, allow public routes and sign-in
    if (isPublicRoute(pathname) || pathname === "/sign-in") {
      return NextResponse.next();
    }
    // Redirect to sign-in for other routes
    return createLoginRedirect(req);
  }
}

export const config = {
  matcher: [
    /*
     * Match specific routes that need authentication checking:
     * - Dashboard and protected pages
     * - Sign-in page (for redirect logic)
     * - API routes (except auth routes)
     */
    "/dashboard/:path*",
    "/secrets/:path*",
    "/profile/:path*",
    "/sign-in",
    "/api/((?!auth).*)",
    "/",
  ],
};
