import { Database, Secret } from "@/types";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { PostgrestError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => Promise.resolve(cookieStore),
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the secret and verify ownership
    const { data: secret, error: secretError }: {
      data: Secret | null;
      error: PostgrestError | null;
    } = await supabase
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

    // Check if secret is active
    if (secret.status !== "active") {
      return NextResponse.json(
        { error: "Secret is not active and cannot be checked in" },
        { status: 400 },
      );
    }

    const now = new Date();
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

    // Update last check-in and next check-in
    const { error: updateError } = await supabase.rpc("check_in_secret", {
      p_secret_id: id,
      p_user_id: user.id,
      p_checked_in_at: now.toISOString(),
      p_next_check_in: nextCheckIn.toISOString(),
    });

    if (updateError) {
      console.error(
        "[POST /api/secrets/[id]/check-in] Update error:",
        updateError,
      );
      return NextResponse.json(
        { error: "Failed to record check-in" },
        { status: 500 },
      );
    }

    // Fetch the updated secret to return to client
    const { data: updatedSecret, error: fetchError }: {
      data: Secret | null;
      error: PostgrestError | null;
    } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !updatedSecret) {
      console.error(
        "[POST /api/secrets/[id]/check-in] Fetch updated secret error:",
        fetchError,
      );
      return NextResponse.json(
        { error: "Failed to fetch updated secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      secret: updatedSecret,
    });
  } catch (error) {
    console.error("[POST /api/secrets/[id]/check-in] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
