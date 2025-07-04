import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database, Secret } from "@/types";
import { PostgrestError } from "@supabase/supabase-js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
        "[POST /api/secrets/[id]/toggle-pause] Secret error:",
        secretError,
      );
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Toggle the status between active and paused
    const newStatus = secret.status === "active" ? "paused" : "active";
    const now = new Date();
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

    // Update the secret status and perform a check-in
    const { error: updateError }: { error: PostgrestError | null } =
      await supabase.rpc("toggle_secret_pause", {
        p_secret_id: id,
        p_user_id: user.id,
        p_new_status: newStatus,
        p_checked_in_at: now.toISOString(),
        p_next_check_in: nextCheckIn.toISOString(),
      });

    if (updateError) {
      console.error(
        "[POST /api/secrets/[id]/toggle-pause] Update error:",
        updateError,
      );
      return NextResponse.json(
        { error: "Failed to update secret" },
        { status: 500 },
      );
    }

    // Fetch the updated secret
    const { data: updatedSecret, error: fetchError }: {
      data: Secret | null;
      error: PostgrestError | null;
    } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error(
        "[POST /api/secrets/[id]/toggle-pause] Error fetching updated secret:",
        fetchError,
      );
      return NextResponse.json(
        { error: "Failed to fetch updated secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, secret: updatedSecret });
  } catch (error) {
    console.error("[POST /api/secrets/[id]/toggle-pause] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
