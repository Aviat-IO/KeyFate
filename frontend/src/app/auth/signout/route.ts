import { clearSupabaseCookies } from "@/lib/cookies";
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  // @ts-expect-error
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Sign out from Supabase
  await supabase.auth.signOut();

  // Create response that redirects to sign in page
  const redirectUrl = new URL("/auth/login", NEXT_PUBLIC_SITE_URL);
  redirectUrl.searchParams.set("signout", "1");
  const response = NextResponse.redirect(redirectUrl);

  clearSupabaseCookies({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    domain: request.nextUrl.hostname,
  });

  return response;
}
