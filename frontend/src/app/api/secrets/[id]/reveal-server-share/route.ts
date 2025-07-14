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

    if (!secret.server_share) {
      return NextResponse.json({ error: "No server share to reveal" }, {
        status: 404,
      });
    }

    return NextResponse.json({
      success: true,
      server_share: secret.server_share,
      iv: secret.iv,
      auth_tag: secret.auth_tag,
    });
  } catch (error) {
    console.error(
      "Error in POST /api/secrets/[id]/reveal-server-share:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
