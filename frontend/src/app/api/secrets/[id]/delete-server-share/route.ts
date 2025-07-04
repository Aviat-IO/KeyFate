import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/types";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing secret ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => Promise.resolve(cookieStore),
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the secret exists and belongs to user
    const { data: secret, error: fetchError } = await supabase
      .from("secrets")
      .select("id, server_share")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Check if server share is already deleted
    if (!secret.server_share) {
      return NextResponse.json(
        { error: "Server share has already been deleted" },
        { status: 410 },
      );
    }

    const update = {
      server_share: null,
      iv: null,
      auth_tag: null,
      status: "paused" as const, // Automatically pause the secret when server share is deleted
    };

    // Delete the server share by setting it to null and pause the secret
    // Also clear the IV and auth_tag since they're no longer needed
    // Pausing ensures no emails will be sent for this secret
    const { error: updateError } = await supabase
      .from("secrets")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DeleteServerShare] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to delete server share",
      },
      { status: 500 },
    );
  }
}
