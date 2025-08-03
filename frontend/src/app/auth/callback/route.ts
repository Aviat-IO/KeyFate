import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token = requestUrl.searchParams.get("token");
  const type = requestUrl.searchParams.get("type");
  const nextUrl = requestUrl.searchParams.get("next");

  console.log("[Callback] Request URL:", request.url);
  console.log("[Callback] Code:", code);
  console.log("[Callback] Token:", token);
  console.log("[Callback] Type:", type);
  console.log("[Callback] Next URL:", nextUrl);

  const supabase = await createClient();

  if (code) {
    // Handle OAuth callback
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error("[Callback] Error exchanging code for session:", error);
    }
  } else if (token && type === "signup") {
    // Handle email verification
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "signup",
      });

      if (error) {
        console.error("[Callback] Error verifying email:", error);
        // Redirect to login with error
        const errorUrl = new URL("/auth/login", NEXT_PUBLIC_SITE_URL);
        errorUrl.searchParams.set(
          "error",
          "Email verification failed. Please try again.",
        );
        return NextResponse.redirect(errorUrl);
      }
    } catch (error) {
      console.error("[Callback] Error during email verification:", error);
      // Redirect to login with error
      const errorUrl = new URL("/auth/login", NEXT_PUBLIC_SITE_URL);
      errorUrl.searchParams.set(
        "error",
        "Email verification failed. Please try again.",
      );
      return NextResponse.redirect(errorUrl);
    }
  }

  // If we reach here, it might be a verification redirect with tokens in fragment
  // We'll redirect to a client-side page that can handle the fragment
  // But only if we don't have a code (which would be OAuth)
  if (!code) {
    const redirectUrl = new URL("/auth/verify", NEXT_PUBLIC_SITE_URL);
    if (nextUrl) {
      redirectUrl.searchParams.set("next", nextUrl);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // For OAuth flows, redirect to next URL if provided, otherwise to dashboard
  const redirectUrl = new URL(nextUrl || "/dashboard", NEXT_PUBLIC_SITE_URL);
  return NextResponse.redirect(redirectUrl);
}
