import { Database } from "@/lib/database.types";
import { encryptMessage } from "@/lib/encryption";
import { NEXT_PUBLIC_SUPABASE_URL } from "@/lib/env";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/server-env";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    // Create a service role client to bypass RLS
    const supabaseAdmin = createClient<Database>(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: "public",
        },
      },
    );

    // Create regular client for auth
    const supabase = createRouteHandlerClient({
      // @ts-expect-error
      cookies: () => cookieStore,
    });

    // Verify authentication using regular client
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      title,
      message,
      recipient_name,
      recipient_email,
      recipient_phone,
      contact_method,
      check_in_days,
    } = body;

    // Calculate next check-in time
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + parseInt(check_in_days));

    // Encrypt the message
    const { encrypted, iv, authTag } = await encryptMessage(message);

    // Store the secret
    const { data: secretData, error: insertError } = await supabaseAdmin
      .from("secrets")
      .insert([{
        user_id: user.id,
        title,
        message: encrypted,
        recipient_name,
        recipient_email: contact_method !== "phone" ? recipient_email : null,
        recipient_phone: contact_method !== "email" ? recipient_phone : null,
        contact_method,
        check_in_days: parseInt(check_in_days),
        next_check_in: nextCheckIn.toISOString(),
        iv,
        auth_tag: authTag,
        status: "active",
      }])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Schedule reminders for the new secret
    const { error: scheduleError } = await supabaseAdmin.rpc(
      "schedule_secret_reminders",
      {
        p_secret_id: secretData.id,
        p_next_check_in: nextCheckIn.toISOString(),
      },
    );

    if (scheduleError) {
      // Create an admin notification about the scheduling failure
      const { error: notificationError } = await supabaseAdmin
        .from("admin_notifications")
        .insert([{
          type: "reminder_scheduling_failed",
          severity: "error",
          title: "Failed to Schedule Reminders",
          message:
            `Failed to schedule reminders for secret "${title}". Error: ${scheduleError.message}`,
          metadata: {
            secret_id: secretData.id,
            error_code: scheduleError.code,
            error_message: scheduleError.message,
            user_id: user.id,
          },
        }]);

      if (notificationError) {
        console.error(
          "Failed to create admin notification:",
          notificationError,
        );
      }

      // Return success but with a warning
      return NextResponse.json({
        success: true,
        warning:
          "Secret created but reminders could not be scheduled. An administrator has been notified.",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CreateSecret] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to create secret",
      },
      { status: 500 },
    );
  }
}
