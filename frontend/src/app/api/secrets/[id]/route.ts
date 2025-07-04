import { decryptMessage } from "@/lib/encryption";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database, Secret, SecretUpdate } from "@/types";
import type { PostgrestError } from "@supabase/supabase-js";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const decrypt = searchParams.get("decrypt") === "true";

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

  const { data: existingSecret, error: fetchError }: {
    data: Secret | null;
    error: PostgrestError | null;
  } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existingSecret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  if (
    decrypt &&
    existingSecret.server_share &&
    existingSecret.iv &&
    existingSecret.auth_tag
  ) {
    // Decrypt the server share for the owner
    try {
      const secret = existingSecret;
      const decryptedServerShare = await decryptMessage(
        secret.server_share!,
        Buffer.from(secret.iv!, "base64"),
        Buffer.from(secret.auth_tag!, "base64"),
      );
      return NextResponse.json({
        secret: {
          ...existingSecret,
          decrypted_server_share: decryptedServerShare,
        },
      });
    } catch (error) {
      console.error("Failed to decrypt server share:", error);
      return NextResponse.json(
        { error: "Failed to decrypt server share" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ secret: existingSecret });
}

export async function PUT(
  req: Request,
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body: {
      title: string;
      recipient_name: string;
      recipient_email: string | null;
      recipient_phone: string | null;
      contact_method: "email" | "phone" | "both";
      check_in_days: string | number;
    } = await req.json();

    // Verify the secret exists and belongs to user
    const { data: existingSecret, error: fetchError }: {
      data: Secret | null;
      error: PostgrestError | null;
    } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingSecret) {
      return NextResponse.json(
        { error: "Secret not found" },
        { status: 404 },
      );
    }

    // Calculate next check-in time
    const parsedCheckInDays = typeof body.check_in_days === "string"
      ? parseInt(body.check_in_days, 10)
      : body.check_in_days;

    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + parsedCheckInDays);

    const updateData: SecretUpdate = {
      title: body.title,
      recipient_name: body.recipient_name,
      recipient_email: body.contact_method !== "phone"
        ? body.recipient_email
        : null,
      recipient_phone: body.contact_method !== "email"
        ? body.recipient_phone
        : null,
      contact_method: body.contact_method,
      check_in_days: parsedCheckInDays,
      next_check_in: nextCheckIn.toISOString(),
    };

    // Update only metadata (no secret content editing allowed with Shamir's)
    const { error: updateError } = await supabase
      .from("secrets")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UpdateSecret] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to update secret",
      },
      { status: 500 },
    );
  }
}
