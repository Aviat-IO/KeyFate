import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { Database } from "../_shared/database.types.ts";
import { getReminderEmailTemplate } from "../_shared/email-templates.ts";

type Secret = Database["public"]["Tables"]["secrets"]["Row"];
type Reminder = Database["public"]["Tables"]["reminders"]["Row"] & {
  secret: Secret;
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface ProcessError extends Error {
  message: string;
}

function formatTimeRemaining(
  type: Reminder["type"],
  timeRemaining: number,
): string {
  const days = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.ceil(timeRemaining / (1000 * 60 * 60));

  switch (type) {
    case "25_percent":
    case "50_percent":
    case "7_days":
    case "3_days":
      return `${days} days`;
    case "24_hours":
    case "12_hours":
    case "1_hour":
      return `${hours} hours`;
    default:
      return `${days} days`;
  }
}

async function processReminders(
  supabaseAdmin: ReturnType<typeof createClient<Database>>,
  from = 0,
): Promise<{ processed: number; hasMore: boolean }> {
  // Get pending reminders that are due
  const { data: reminders, error: remindersError } = await supabaseAdmin
    .from("reminders")
    .select(
      `
      *,
      secret:secrets (
        *
      )
    `,
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .range(from, from + 49)
    .order("scheduled_for", { ascending: true });

  if (remindersError) {
    throw new Error(`Failed to fetch reminders: ${remindersError.message}`);
  }

  if (!reminders || reminders.length === 0) {
    return { processed: 0, hasMore: false };
  }

  const processedReminders = await Promise.all(
    reminders.map(async (reminder: Reminder) => {
      try {
        const secret = reminder.secret;
        if (!secret) {
          throw new Error("Secret not found");
        }

        // Skip if secret is not active
        if (secret.status !== "active") {
          await supabaseAdmin
            .from("reminders")
            .update({ status: "cancelled" })
            .eq("id", reminder.id);
          return { id: reminder.id, status: "cancelled" };
        }

        // Get user's email from user_contact_methods
        const { data: contactMethod } = await supabaseAdmin
          .from("user_contact_methods")
          .select("email")
          .eq("user_id", reminder.user_id)
          .single();

        if (!contactMethod?.email) {
          throw new Error("User email not found");
        }

        // Calculate time remaining
        const nextCheckIn = new Date(secret.next_check_in!);
        const now = new Date();
        const timeRemaining = nextCheckIn.getTime() - now.getTime();

        // Format the email content using the template
        const emailHtml = getReminderEmailTemplate({
          secretTitle: secret.title,
          timeRemaining: formatTimeRemaining(reminder.type, timeRemaining),
          nextCheckIn: nextCheckIn.toLocaleString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            timeZoneName: "short",
          }),
          checkInUrl: `${Deno.env.get("SITE_URL")}/dashboard`,
        });

        const emailPayload: EmailPayload = {
          to: contactMethod.email,
          subject: `Reminder: "${secret.title}" needs attention`,
          html: emailHtml,
        };

        // Send email using Supabase Edge Function
        const emailResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${
                Deno.env.get(
                  "SUPABASE_SERVICE_ROLE_KEY",
                )
              }`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailPayload),
          },
        );

        if (!emailResponse.ok) {
          throw new Error("Failed to send email");
        }

        // Mark reminder as sent
        await supabaseAdmin
          .from("reminders")
          .update({ status: "sent" })
          .eq("id", reminder.id);

        return { id: reminder.id, status: "sent" };
      } catch (error) {
        const processError = error as ProcessError;
        console.error(
          `Error processing reminder ${reminder.id}:`,
          processError.message,
        );

        // Call the handle_failed_reminder function
        const { error: handleError } = await supabaseAdmin.rpc(
          "handle_failed_reminder",
          {
            p_reminder_id: reminder.id,
            p_error: processError.message,
          },
        );

        if (handleError) {
          console.error(
            "Error handling failed reminder:",
            handleError.message,
          );
        }

        return {
          id: reminder.id,
          status: "retry",
          error: processError.message,
        };
      }
    }),
  );

  return {
    processed: processedReminders.length,
    hasMore: processedReminders.length === 50,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient<Database>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      },
    );

    let from = 0;
    let totalProcessed = 0;
    let hasMore = true;
    const results = [];

    // Process reminders in batches until no more are found
    while (hasMore) {
      const { processed, hasMore: moreReminders } = await processReminders(
        supabaseAdmin,
        from,
      );
      totalProcessed += processed;
      hasMore = moreReminders;
      from += 50;

      // Add a small delay between batches to avoid rate limits
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return new Response(
      JSON.stringify({
        message: "Reminders processed",
        totalProcessed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const processError = error as ProcessError;
    console.error("Error processing reminders:", processError.message);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
