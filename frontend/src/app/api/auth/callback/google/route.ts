/**
 * Explicit Google OAuth callback handler
 * This ensures callbacks work properly in production environments
 */

import { NextRequest, NextResponse } from "next/server";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Log the callback for debugging
  console.log("[OAuth Callback] Google callback received:", {
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams),
    headers: {
      host: request.headers.get("host"),
      referer: request.headers.get("referer"),
    },
  });

  // Redirect to the NextAuth callback handler
  const url = new URL("/api/auth/callback/google", request.nextUrl.origin);

  // Copy all search params
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}
