import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(request: NextRequest & { nextauth: { token: any } }) {
    const { pathname } = request.nextUrl;
    const token = request.nextauth.token;

    // Log for debugging (remove in production)
    if (process.env.NODE_ENV !== "production") {
      console.log("[Middleware] Path:", pathname);
      console.log("[Middleware] Token exists:", !!token);
      console.log("[Middleware] Token details:", token ? { id: token.id, email: token.email } : null);
    }

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
    // IMPORTANT: Use the same secret as in your [...nextauth].ts
    secret: process.env.NEXTAUTH_SECRET,
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