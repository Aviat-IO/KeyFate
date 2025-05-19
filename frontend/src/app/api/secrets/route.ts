import { Database } from "@/types";
import { NEXT_PUBLIC_SUPABASE_URL } from "@/lib/env";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/server-env";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({
    // @ts-expect-error - Supabase auth helpers expect different cookie format
    cookies: () => cookieStore,
  });

  try {
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
      server_share,
      iv,
      auth_tag,
      recipient_name,
      recipient_email,
      recipient_phone,
      contact_method,
      check_in_days,
      sss_shares_total,
      sss_threshold,
    } = body;

    if (!server_share || !iv || !auth_tag) {
      return NextResponse.json(
        { error: "Missing encrypted server share, IV, or auth tag." },
        { status: 400 },
      );
    }

    if (
      typeof sss_shares_total !== "number" ||
      sss_shares_total < 2 ||
      typeof sss_threshold !== "number" ||
      sss_threshold < 2 ||
      sss_threshold > sss_shares_total
    ) {
      return NextResponse.json(
        { error: "Invalid SSS shares total or threshold parameters." },
        { status: 400 },
      );
    }

    const nextCheckIn = new Date();
    const parsedCheckInDays = parseInt(check_in_days, 10);
    if (isNaN(parsedCheckInDays) || parsedCheckInDays <= 0) {
      return NextResponse.json({ error: "Invalid check_in_days value." }, {
        status: 400,
      });
    }
    nextCheckIn.setDate(nextCheckIn.getDate() + parsedCheckInDays);

    const { data: secretData, error: insertError } = await supabaseAdmin
      .from("secrets")
      .insert([{
        user_id: user.id,
        title,
        server_share: server_share,
        recipient_name,
        recipient_email: contact_method === "email" || contact_method === "both"
          ? recipient_email
          : null,
        recipient_phone: contact_method === "phone" || contact_method === "both"
          ? recipient_phone
          : null,
        contact_method,
        check_in_days: parsedCheckInDays,
        next_check_in: nextCheckIn.toISOString(),
        iv: iv,
        auth_tag: auth_tag,
        status: "active",
        sss_shares_total: sss_shares_total,
        sss_threshold: sss_threshold,
      }])
      .select("id")
      .single();

    if (insertError) {
      console.error("[CreateSecret DB Insert Error]:", insertError);
      return NextResponse.json({
        error: "Database error: " + insertError.message,
      }, { status: 500 });
    }

    if (!secretData || !secretData.id) {
      console.error(
        "[CreateSecret DB Insert Error]: No secret data or ID returned after insert.",
      );
      return NextResponse.json({
        error: "Failed to create secret and retrieve ID.",
      }, { status: 500 });
    }

    const { error: scheduleError } = await supabaseAdmin.rpc(
      "schedule_secret_reminders",
      {
        p_secret_id: secretData.id,
        p_next_check_in: nextCheckIn.toISOString(),
      },
    );

    if (scheduleError) {
      const { error: notificationError } = await supabaseAdmin
        .from("admin_notifications")
        .insert([{
          type: "reminder_scheduling_failed",
          severity: "error",
          title: "Failed to Schedule Reminders",
          message:
            `Failed to schedule reminders for secret titled \\"${title}\\" (ID: ${secretData.id}). Error: ${scheduleError.message}`,
          metadata: {
            secret_id: secretData.id,
            error_code: scheduleError.code,
            error_message: scheduleError.message,
            user_id: user.id,
          },
        }]);

      if (notificationError) {
        console.error(
          "Failed to create admin notification for reminder scheduling failure:",
          notificationError,
        );
      }
      return NextResponse.json({
        secretId: secretData.id,
        warning:
          "Secret created, but reminder scheduling failed. An administrator has been notified.",
      });
    }

    return NextResponse.json({ secretId: secretData.id });
  } catch (error) {
    console.error("[CreateSecret API Error]:", error);
    const errorMessage = (error instanceof Error && error.message)
      ? error.message
      : "An unexpected error occurred.";
    return NextResponse.json(
      {
        error: "Failed to create secret: " + errorMessage,
      },
      { status: 500 },
    );
  }
}
