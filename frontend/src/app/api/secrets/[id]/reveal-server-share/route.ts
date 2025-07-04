import { decryptMessage } from "@/lib/encryption";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database, Secret } from "@/types";
import { PostgrestError } from "@supabase/supabase-js";

export async function POST(
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

    // Fetch the secret and verify ownership
    const { data: secret, error: fetchError }: {
      data: Pick<Secret, "server_share" | "iv" | "auth_tag"> | null;
      error: PostgrestError | null;
    } = await supabase
      .from("secrets")
      .select("server_share, iv, auth_tag")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Check if server share exists (not deleted)
    if (!secret.server_share) {
      return NextResponse.json(
        { error: "Server share has been deleted" },
        { status: 410 },
      );
    }

    // Decrypt the server share
    const decryptedServerShare = await decryptMessage(
      secret.server_share,
      Buffer.from(secret.iv!, "base64"),
      Buffer.from(secret.auth_tag!, "base64"),
    );

    return NextResponse.json({ serverShare: decryptedServerShare });
  } catch (error) {
    console.error("[RevealServerShare] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to reveal server share",
      },
      { status: 500 },
    );
  }
}
