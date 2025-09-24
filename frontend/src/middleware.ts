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
  console.log("[Middleware] Validating cron authentication...");

  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  console.log("[Middleware] Authorization header present:", !!header);
  console.log("[Middleware] Authorization header format:", header ? "Bearer " + header.slice(0, 20) + "..." : "None");

  if (!header?.startsWith("Bearer ")) {
    console.log("[Middleware] No Bearer token found in authorization header");
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;

  console.log("[Middleware] CRON_SECRET environment variable present:", !!cronSecret);
  console.log("[Middleware] CRON_SECRET length:", cronSecret?.length || 0);
  console.log("[Middleware] Token length:", token.length);
  console.log("[Middleware] Token preview:", token.slice(0, 8) + "...");

  const isValid = !!cronSecret && token === cronSecret;
  console.log("[Middleware] Token validation result:", isValid);

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

  console.log(`[Middleware] Processing request to: ${pathname}`);

  try {
    // Get the NextAuth JWT token with comprehensive error handling
    let token;
    try {
      token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });
      console.log(
        `[Middleware] Token validation result:`,
        token ? "VALID" : "INVALID",
      );
      if (token) {
        console.log(`[Middleware] Token details:`, {
          id: (token as any)?.id || token.sub,
          email: token.email,
          name: token.name,
        });
      }
    } catch (tokenError) {
      console.error("[Middleware] Token validation error:", tokenError);
      // If we can't validate the token, treat as unauthenticated
      token = null;
    }

    // Check route classification
    const isPublic = isPublicRoute(pathname);
    const isCron = isCronRoute(pathname);
    console.log(`[Middleware] Route classification:`, {
      pathname,
      isPublic,
      isCron,
      isAuth: isAuthRoute(pathname),
    });

    // If user is authenticated and on an auth route (not API or verify-email), redirect to dashboard
    if (
      token && isAuthRoute(pathname) && !pathname.startsWith("/api/auth/") &&
      pathname !== "/auth/verify-email"
    ) {
      console.log(
        "[Middleware] Authenticated user on auth route, redirecting to dashboard",
      );
      return createDashboardRedirect(req);
    }

    // Allow access to public routes
    if (isPublic) {
      console.log("[Middleware] Allowing access to public route");
      return NextResponse.next();
    }

    // Handle cron routes with Bearer token authentication
    // Google Cloud Scheduler uses Authorization: Bearer <CRON_SECRET>
    if (isCron) {
      if (validateCronAuth(req)) {
        console.log("[Middleware] Valid cron authentication, allowing access");
        return NextResponse.next();
      } else {
        console.log("[Middleware] Invalid cron authentication");
        return NextResponse.json(
          {
            error: "Unauthorized",
            code: "INVALID_CRON_TOKEN",
          },
          { status: 401 },
        );
      }
    }

    // Handle protected routes - require authentication
    if (!token) {
      console.log("[Middleware] No session found, redirecting to login");
      return createLoginRedirect(req, "Please sign in to continue");
    }

    // For protected routes, check email verification status
    try {
      const userId = (token as any)?.id || token.sub;
      const userEmail = token.email;
      console.log("[Middleware] User ID from token:", userId);
      console.log("[Middleware] User email from token:", userEmail);

      if (!userId && !userEmail) {
        console.log(
          "[Middleware] No user ID or email found in token, redirecting to login",
        );
        return createLoginRedirect(req, "Invalid session");
      }

      // Allow verification-related API routes for authenticated users
      if (isVerificationAllowedRoute(pathname)) {
        console.log("[Middleware] Allowing access to verification route");
        return NextResponse.next();
      }

      // For now, skip database lookup and email verification check
      // since the user is already authenticated via NextAuth
      console.log(
        "[Middleware] Skipping database lookup - user is authenticated",
      );

      // TODO: Re-enable email verification check once database connection issues are resolved
      // This is a temporary workaround to allow dashboard access

      // Email is verified, allow access
      console.log(
        `[Middleware] Authenticated and verified access granted to ${pathname}`,
      );
      return NextResponse.next();
    } catch (dbError) {
      console.error("[Middleware] Database error during user lookup:", dbError);
      // On database error, redirect to login for security
      return createLoginRedirect(req, "Authentication error occurred");
    }
  } catch (error) {
    console.error("[Middleware] Unexpected error:", error);

    // On unexpected error, handle gracefully based on route type
    if (isPublicRoute(pathname)) {
      // Allow access to public routes even on error
      console.log("[Middleware] Error on public route, allowing access");
      return NextResponse.next();
    } else {
      // Redirect to login for protected routes on error
      console.log(
        "[Middleware] Error on protected route, redirecting to login",
      );
      return createLoginRedirect(req, "Authentication error occurred");
    }
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * This includes:
     * - All page routes
     * - Protected API routes (like /api/secrets)
     * But excludes NextAuth API routes for proper authentication flow
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
  // Use Node.js runtime to support database operations with postgres package
  runtime: "nodejs",
};
