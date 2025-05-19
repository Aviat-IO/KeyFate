import { decryptMessage } from "@/lib/encryption";
import { NEXT_PUBLIC_SUPABASE_URL } from "@/lib/env";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/server-env";
import { Database } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!id) {
    return NextResponse.json({ error: "Secret ID is required" }, {
      status: 400,
    });
  }
  if (!token) {
    return NextResponse.json({ error: "Access token is required" }, {
      status: 400,
    });
  }

  const supabaseAdmin = createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
    },
  );

  try {
    // 1. Fetch and validate the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("recipient_access_tokens")
      .select("*")
      .eq("token", token)
      .eq("secret_id", id)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token validation error:", tokenError);
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 403 },
      );
    }

    const now = new Date();
    if (tokenData.used_at) {
      const usedAtDate = new Date(tokenData.used_at);
      const gracePeriodEnds = new Date(
        usedAtDate.getTime() + 24 * 60 * 60 * 1000,
      ); // 24 hour grace period
      if (now > gracePeriodEnds) {
        return NextResponse.json(
          {
            error:
              "Token has already been used and the grace period has expired.",
          },
          { status: 403 },
        );
      }
      // If within grace period, allow access but don't update used_at again.
    }

    if (now > new Date(tokenData.expires_at)) {
      return NextResponse.json(
        { error: "Token has expired." },
        { status: 403 },
      );
    }

    // 2. Fetch the secret
    const { data: secret, error: secretError } = await supabaseAdmin
      .from("secrets")
      .select("server_share, iv, auth_tag")
      .eq("id", id)
      .single();

    if (secretError || !secret) {
      console.error("Secret fetch error:", secretError);
      return NextResponse.json({ error: "Secret not found." }, { status: 404 });
    }

    if (!secret.server_share || !secret.iv || !secret.auth_tag) {
      console.error("Secret data incomplete for decryption:", secret);
      return NextResponse.json(
        {
          error:
            "This secret has been disabled. The server share has been deleted and is no longer available.",
        },
        { status: 410 }, // 410 Gone - resource no longer available
      );
    }

    // 3. Decrypt the server share
    const decryptedServerShare = await decryptMessage(
      secret.server_share,
      Buffer.from(secret.iv, "base64"),
      Buffer.from(secret.auth_tag, "base64"),
    );

    // 4. Mark token as used if it hasn't been marked already
    if (!tokenData.used_at) {
      const { error: updateTokenError } = await supabaseAdmin
        .from("recipient_access_tokens")
        .update({ used_at: now.toISOString() })
        .eq("id", tokenData.id);

      if (updateTokenError) {
        console.error("Failed to mark token as used:", updateTokenError);
        // Non-critical for returning the share, but should be logged/monitored
      }
    }

    return NextResponse.json({ serverShare: decryptedServerShare });
  } catch (error: unknown) {
    console.error("[ServerShare API Error]:", error);
    return NextResponse.json(
      {
        error: "Internal server error: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 },
    );
  }
}
