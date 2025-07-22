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
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`Checking in secret ${id} for user ${user.id}`);

    const { data: secret, error: fetchError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      console.error("Secret fetch error:", fetchError);
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Calculate next check-in
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

    console.log(`Calling check_in_secret RPC with:`, {
      p_secret_id: id,
      p_user_id: user.id,
      p_checked_in_at: new Date().toISOString(),
      p_next_check_in: nextCheckIn.toISOString(),
    });

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
        { error: `Failed to record check-in: ${rpcError.message}` },
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

    console.log("Check-in successful for secret:", id);

    return NextResponse.json({
      success: true,
      secret: updatedSecret,
      next_check_in: nextCheckIn,
    });
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/check-in:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Internal Server Error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
