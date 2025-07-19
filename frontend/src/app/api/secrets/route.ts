import { secretSchema } from "@/lib/schemas/secret";
import { Tables } from "@/types";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

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

    // Handle contact method logic
    const insertData = {
      ...validatedData,
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
