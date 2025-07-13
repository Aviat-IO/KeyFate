import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL!));
}
