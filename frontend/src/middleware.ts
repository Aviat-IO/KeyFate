import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    // Refresh the session and get a new access token
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[Middleware] Session error:", sessionError);
      return res;
    }

    // Protected routes
    if (
      req.nextUrl.pathname.startsWith("/dashboard") ||
      req.nextUrl.pathname.startsWith("/secrets")
    ) {
      if (!session) {
        console.log("[Middleware] No session found");
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/auth/login";
        redirectUrl.searchParams.set("error", "Please sign in to continue");
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Auth routes - redirect to dashboard if already logged in
    if (req.nextUrl.pathname.startsWith("/auth") && session) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }

    return res;
  } catch (error) {
    console.error("[Middleware] Error:", error);
    return res;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/secrets/:path*", "/auth/:path*"],
};
