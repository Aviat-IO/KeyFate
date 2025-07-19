import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
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

    // Calculate next check-in
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

    // Use RPC function for check-in
    const { error: rpcError } = await supabase.rpc("check_in_secret", {
      p_secret_id: id,
      p_user_id: user.id,
      p_checked_in_at: new Date().toISOString(),
      p_next_check_in: nextCheckIn.toISOString(),
    });

    if (rpcError) {
      console.error("Error in check-in transaction:", rpcError);
      return NextResponse.json(
        { error: "Failed to record check-in" },
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
      next_check_in: nextCheckIn,
    });
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/check-in:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
