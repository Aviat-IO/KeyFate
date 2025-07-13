import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();

    // Get the token from query params
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verify the token and get the secret
    const { data: secret, error } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", params.id)
      .eq("checkin_token", token)
      .single();

    if (error || !secret) {
      return NextResponse.json({ error: "Invalid token or secret not found" }, {
        status: 404,
      });
    }

    if (!secret.server_share) {
      return NextResponse.json({ error: "Server share not available" }, {
        status: 410,
      });
    }

    return NextResponse.json({
      server_share: secret.server_share,
      iv: secret.iv,
      auth_tag: secret.auth_tag,
      sss_threshold: secret.sss_threshold,
      sss_shares_total: secret.sss_shares_total,
    });
  } catch (error) {
    console.error("Error in GET /api/secrets/[id]/reveal-server-share:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
