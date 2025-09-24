import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextUrl = requestUrl.searchParams.get("next");

  console.log("[Callback] NextAuth callback - Request URL:", request.url);
  console.log("[Callback] Next URL:", nextUrl);

  // NextAuth handles all OAuth callback logic internally
  // This callback route is primarily for custom redirects after authentication

  // Redirect to the next URL if provided, otherwise to dashboard
  const redirectUrl = new URL(nextUrl || "/dashboard", NEXT_PUBLIC_SITE_URL);
  return NextResponse.redirect(redirectUrl);
}
