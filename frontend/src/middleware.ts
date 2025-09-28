import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Custom middleware that handles auth properly in production
async function customMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/sign-in",
    "/auth/signup",
    "/auth/verify-email",
    "/pricing",
    "/terms-of-service",
    "/privacy-policy",
  ];

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));

  // API auth routes should always be accessible
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // For public routes, allow access
  if (isPublicRoute) {
    // Get token to check if user is authenticated
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // If user is authenticated and trying to access sign-in, redirect to dashboard
    if (token && pathname === "/sign-in") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // For protected routes, check authentication using getToken
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // Redirect to sign-in page
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Wrap with NextAuth's withAuth for additional functionality
export default withAuth(
  async function middleware(request: NextRequest & { nextauth: { token: any } }) {
    const { pathname } = request.nextUrl;
    const token = request.nextauth.token;

    // Log for debugging
    console.log("[Middleware withAuth] Path:", pathname);
    console.log("[Middleware withAuth] Token exists:", !!token);
    console.log("[Middleware withAuth] Token ID:", token?.id || token?.sub);

    // If user is authenticated and trying to access sign-in page, redirect to dashboard
    if (token && pathname === "/sign-in") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Allow the request to continue
    return NextResponse.next();
  },
  {
    callbacks: {
      // The authorized callback is called BEFORE the middleware function above
      // If this returns false, the user will be redirected to the sign-in page
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes that don't require authentication
        const publicRoutes = [
          "/",
          "/sign-in",
          "/auth/signup",
          "/auth/verify-email",
          "/pricing",
          "/terms-of-service",
          "/privacy-policy",
        ];

        // Check if the current path is public
        const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));

        // API auth routes should always be accessible
        if (pathname.startsWith("/api/auth")) {
          return true;
        }

        // Public routes are always authorized
        if (isPublicRoute) {
          return true;
        }

        // Protected routes require a token
        return !!token;
      },
    },
    pages: {
      signIn: "/sign-in",
      error: "/auth/error",
    },
    secret: process.env.NEXTAUTH_SECRET,
    // Trust the host header (important for Cloud Run)
    trustHost: true,
  }
);

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
};