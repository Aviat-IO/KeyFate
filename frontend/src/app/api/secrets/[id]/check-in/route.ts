import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Secret } from "@/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({
      // @ts-expect-error - cookies function signature mismatch with Next.js 15
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
      .eq("id", id)
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
    const nextCheckIn = new Date();
    nextCheckIn.setDate(
      nextCheckIn.getDate() + (secret as Secret).check_in_days,
    );

    // Start a transaction to update both tables
    const { error: transactionError } = await supabase.rpc("check_in_secret", {
      p_secret_id: id,
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

    // Fetch the updated secret
    const { data: updatedSecret, error: fetchError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error(
        "[POST /api/secrets/[id]/check-in] Error fetching updated secret:",
        fetchError,
      );
      return NextResponse.json(
        { error: "Failed to fetch updated secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, secret: updatedSecret });
  } catch (error) {
    console.error("[POST /api/secrets/[id]/check-in] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
