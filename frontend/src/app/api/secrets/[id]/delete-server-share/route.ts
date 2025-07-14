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

    // Verify ownership
    const { data: secret, error: fetchError } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Delete the server share and update status to paused
    const { error: updateError } = await supabase
      .from("secrets")
      .update({
        server_share: null,
        iv: null,
        auth_tag: null,
        status: "paused",
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error deleting server share:", updateError);
      return NextResponse.json(
        { error: "Failed to delete server share" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Error in POST /api/secrets/[id]/delete-server-share:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
