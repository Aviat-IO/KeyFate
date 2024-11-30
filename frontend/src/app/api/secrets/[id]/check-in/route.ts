import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => cookieStore,
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the secret and verify ownership
    const { data: secret, error: secretError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (secretError || !secret) {
      console.error(
        "[POST /api/secrets/[id]/check-in] Secret error:",
        secretError,
      );
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Update check-in time
    const now = new Date();
    const nextCheckIn = new Date(now);
    const days = parseInt(secret.check_in_interval.match(/(\d+) days/)[1]);
    nextCheckIn.setDate(nextCheckIn.getDate() + days);

    // Start a transaction to update both tables
    const { error: transactionError } = await supabase.rpc("check_in_secret", {
      p_secret_id: params.id,
      p_user_id: user.id,
      p_checked_in_at: now.toISOString(),
      p_next_check_in: nextCheckIn.toISOString(),
    });

    if (transactionError) {
      console.error(
        "[POST /api/secrets/[id]/check-in] Transaction error:",
        transactionError,
      );
      return NextResponse.json(
        { error: "Failed to record check-in" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/secrets/[id]/check-in] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
