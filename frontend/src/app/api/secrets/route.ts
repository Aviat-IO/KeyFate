import { secretSchema } from "@/lib/schemas/secret";
import { Tables } from "@/types";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { encryptMessage } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate the request body
    let validatedData;
    try {
      validatedData = secretSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        return NextResponse.json(
          { error: firstError.message },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    // Encrypt the server share before storing (only if not already provided)
    let encryptedServerShare: string;
    let iv: string;
    let authTag: string;

    if (validatedData.iv && validatedData.auth_tag) {
      // Use provided encrypted data (for testing/backward compatibility)
      encryptedServerShare = validatedData.server_share;
      iv = validatedData.iv;
      authTag = validatedData.auth_tag;
    } else {
      // Encrypt the plain server share
      const encrypted = await encryptMessage(validatedData.server_share);
      encryptedServerShare = encrypted.encrypted;
      iv = encrypted.iv;
      authTag = encrypted.authTag;
    }

    // Handle contact method logic
    const insertData = {
      ...validatedData,
      server_share: encryptedServerShare,
      iv: iv,
      auth_tag: authTag,
      user_id: user.user.id,
    } as Tables<"secrets">["Insert"];

    // Set recipient_email to null for phone-only contact
    if (validatedData.contact_method === "phone") {
      insertData.recipient_email = null;
    }

    const { data, error } = await supabase
      .from("secrets")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Error creating secret:", error);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 },
      );
    }

    // Schedule reminder (mock implementation for tests)
    let warning = undefined;
    try {
      const { error: reminderError } = await supabase.rpc(
        "schedule_secret_reminders",
        {
          p_secret_id: data.id,
          p_next_check_in: new Date(
            Date.now() + validatedData.check_in_days * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      );

      if (reminderError) {
        warning =
          `Warning: reminder scheduling failed - ${reminderError.message}`;
      }
    } catch (reminderError) {
      warning = `Warning: reminder scheduling failed - ${reminderError}`;
    }

    return NextResponse.json({
      secretId: data.id,
      ...data,
      ...(warning && { warning }),
    });
  } catch (error) {
    console.error("Error in POST /api/secrets:", error);
    return NextResponse.json(
      { error: "Failed to create secret" },
      { status: 500 },
    );
  }
}
