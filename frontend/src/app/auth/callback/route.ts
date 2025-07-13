import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
