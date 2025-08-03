import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const supabase = await createClient();

  // Check if a user's logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/", NEXT_PUBLIC_SITE_URL));
}
