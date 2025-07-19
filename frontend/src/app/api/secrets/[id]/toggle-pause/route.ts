import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: secret, error: fetchError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    const newStatus = secret.status === "active" ? "paused" : "active";

    // Use RPC function for toggle operation
    const { error: rpcError } = await supabase.rpc("toggle_secret_pause", {
      p_secret_id: id,
      p_user_id: user.id,
      p_new_status: newStatus,
      p_checked_in_at: new Date().toISOString(),
      p_next_check_in: new Date(
        Date.now() + secret.check_in_days * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    if (rpcError) {
      console.error("Error in toggle operation:", rpcError);
      return NextResponse.json(
        { error: "Failed to update secret" },
        { status: 500 },
      );
    }

    // Fetch updated secret
    const { data: updatedSecret, error: updateFetchError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (updateFetchError || !updatedSecret) {
      console.error("Error fetching updated secret:", updateFetchError);
      return NextResponse.json(
        { error: "Failed to fetch updated secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      secret: updatedSecret,
      status: newStatus,
    });
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/toggle-pause:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
