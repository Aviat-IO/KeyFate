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

    const newStatus = secret.status === "active" ? "paused" : "active";

    const { error: updateError } = await supabase
      .from("secrets")
      .update({ status: newStatus })
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error toggling pause status:", updateError);
      return NextResponse.json(
        { error: "Failed to toggle pause status" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/toggle-pause:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
