import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => Promise.resolve(cookieStore),
    });

    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error("[Callback] Error exchanging code for session:", error);
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
