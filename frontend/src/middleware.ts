import { updateSession } from "@/utils/supabase/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const NON_AUTH_ROUTE_REGEXES = [
  /^\/auth\/.*/,
  /^\/$/,
];

export async function middleware(req: NextRequest) {
  try {
    // Update session and get user
    const { user, supabaseResponse } = await updateSession(req);

    // Protected routes
    if (
      !user &&
      !NON_AUTH_ROUTE_REGEXES.some((regex) => regex.test(req.nextUrl.pathname))
    ) {
      console.log("[Middleware] No session found");
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/auth/login";
      redirectUrl.searchParams.set("error", "Please sign in to continue");
      return NextResponse.redirect(redirectUrl);
    }

    // Auth routes - redirect to dashboard if already logged in
    // Exclude callback route from this redirect to allow OAuth flow to complete
    if (
      req.nextUrl.pathname.startsWith("/auth") &&
      !req.nextUrl.pathname.startsWith("/auth/signout") &&
      !req.nextUrl.pathname.startsWith("/auth/callback") &&
      user
    ) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[Middleware] Error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/secrets/:path*", "/auth/:path*"],
};
