import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();

    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error("[Callback] Error exchanging code for session:", error);
    }
  }

  const redirectUrl = new URL("/dashboard", NEXT_PUBLIC_SITE_URL);

  return NextResponse.redirect(redirectUrl);
}
