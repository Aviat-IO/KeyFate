import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: secret, error: fetchError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Calculate next check-in
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

    const { error: updateError } = await supabase
      .from("secrets")
      .update({
        last_check_in: new Date().toISOString(),
        next_check_in: nextCheckIn.toISOString(),
      })
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating check-in:", updateError);
      return NextResponse.json(
        { error: "Failed to update check-in" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, next_check_in: nextCheckIn });
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/check-in:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
