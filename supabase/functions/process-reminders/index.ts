import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { Database } from "../_shared/database.types.ts";
import { getReminderEmailTemplate } from "../_shared/email-templates.ts";
import {
  ANON_KEY,
  API_URL,
  SERVICE_ROLE_KEY,
  SITE_URL,
} from "../_shared/env.ts";
import { Reminder, Secret } from "../_shared/types.ts";
import {
  createUnauthorizedResponse,
  validateServiceRoleAuth,
} from "../_shared/auth.ts";

const BATCH_SIZE = 50;

type ReminderWithSecret = Reminder & {
  secret: Secret | null;
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface SMSPayload {
  to: string;
  body: string;
}

interface ProcessError extends Error {
  message: string;
}

interface ContactMethods {
  email?: string;
  phone?: string;
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

async function getUserContactMethods(
  supabaseAdmin: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<ContactMethods> {
  console.log("[DEBUG] Getting contact methods for user:", userId);

  // First try user_contact_methods
  const { data: contactMethod } = await supabaseAdmin
    .from("user_contact_methods")
    .select("email, phone")
    .eq("user_id", userId)
    .single();

  if (contactMethod?.email || contactMethod?.phone) {
    console.log(
      "[DEBUG] Found contact methods in user_contact_methods:",
      contactMethod,
    );
    return {
      email: contactMethod.email || undefined,
      phone: contactMethod.phone || undefined,
    };
  }

  // If not found, try auth.users
  const { data: userData } = await supabaseAdmin
    .auth
    .admin
    .getUserById(userId);

  if (userData?.user) {
    console.log("[DEBUG] Found user in auth.users:", {
      email: userData.user.email,
      phone: userData.user.phone,
    });
    return {
      email: userData.user.email,
      phone: userData.user.phone,
    };
  }

  console.log("[DEBUG] No contact methods found for user:", userId);
  return {};
}

async function sendSMS(payload: SMSPayload): Promise<boolean> {
  // TODO: Implement Twilio integration
  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log("[DEBUG] Would send SMS:", payload);
  return true;
}

async function processReminders(
  supabaseAdmin: ReturnType<typeof createClient<Database>>,
  from = 0,
): Promise<{ processed: number; hasMore: boolean }> {
  console.log(
    "[DEBUG] Starting processReminders function at:",
    new Date().toISOString(),
  );

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
    .range(from, from + BATCH_SIZE - 1)
    .order("scheduled_for", { ascending: true });

  console.log("Reminders error:", remindersError);
  console.log("Reminders data:", reminders);

  if (remindersError) {
    throw new Error(`Failed to fetch reminders: ${remindersError.message}`);
  }

  if (!reminders || reminders.length === 0) {
    return { processed: 0, hasMore: false };
  }

  const processedReminders = await Promise.all(
    reminders.map(async (reminder: ReminderWithSecret) => {
      try {
        const secret = reminder.secret;
        if (!secret) {
          // Secret was deleted, cancel the reminder
          await supabaseAdmin
            .from("reminders")
            .update({ status: "cancelled" })
            .eq("id", reminder.id);
          return { id: reminder.id, status: "cancelled" };
        }

        // Skip if secret is not active or server share has been deleted
        if (secret.status !== "active" || !secret.server_share) {
          await supabaseAdmin
            .from("reminders")
            .update({ status: "cancelled" })
            .eq("id", reminder.id);
          return { id: reminder.id, status: "cancelled" };
        }

        // Get user's contact methods
        const contactMethods = await getUserContactMethods(
          supabaseAdmin,
          reminder.user_id,
        );

        if (!contactMethods.email && !contactMethods.phone) {
          throw new Error("No contact methods found for user");
        }

        // Calculate time remaining
        const nextCheckIn = new Date(secret.next_check_in!);
        const now = new Date();
        const timeRemaining = nextCheckIn.getTime() - now.getTime();

        let notificationSent = false;

        // Generate a secure random token directly in the Edge Function
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const token = Array.from(
          tokenBytes,
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");

        // Insert the token directly into the database
        const { error: insertError } = await supabaseAdmin
          .from("check_in_tokens")
          .insert({
            secret_id: secret.id,
            token: token,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
              .toISOString(), // 24 hours
          });

        if (insertError) {
          console.error("Failed to insert check-in token:", insertError);
          throw new Error("Failed to create check-in token");
        }

        // Try email first if available
        if (contactMethods.email) {
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
            checkInUrl: `${SITE_URL}/check-in?token=${token}`,
          });

          const emailPayload: EmailPayload = {
            to: contactMethods.email,
            subject: `Reminder: "${secret.title}" needs attention`,
            html: emailHtml,
          };

          // Send email using Supabase Edge Function
          const emailResponse = await fetch(
            `${API_URL}/functions/v1/send-email`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ANON_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailPayload),
            },
          );

          if (emailResponse.ok) {
            notificationSent = true;
          } else {
            console.error("Failed to send email notification");
          }
        }

        // Try SMS if email failed or wasn't available
        if (!notificationSent && contactMethods.phone) {
          const smsPayload: SMSPayload = {
            to: contactMethods.phone,
            body: `Reminder: Your secret "${secret.title}" needs attention. ${
              formatTimeRemaining(reminder.type, timeRemaining)
            } remaining until expiry. Visit ${SITE_URL}/dashboard to check in.`,
          };

          const smsSent = await sendSMS(smsPayload);
          if (smsSent) {
            notificationSent = true;
          } else {
            console.error("Failed to send SMS notification");
          }
        }

        if (!notificationSent) {
          throw new Error(
            "Failed to send notifications via all available methods",
          );
        }

        // Mark reminder as sent
        await supabaseAdmin
          .from("reminders")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
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

  console.log("[DEBUG] Processed reminders:", processedReminders);

  return {
    processed: processedReminders.length,
    hasMore: processedReminders.length === BATCH_SIZE,
  };
}

Deno.serve(async (req) => {
  console.log("[DEBUG] Function triggered at:", new Date().toISOString());

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate service role authentication
  if (!validateServiceRoleAuth(req)) {
    return createUnauthorizedResponse();
  }

  try {
    const supabaseAdmin = createClient<Database>(
      API_URL,
      SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
        db: {
          schema: "public",
        },
        global: {
          headers: {
            "X-Client-Info": "supabase-js/2.39.0",
          },
        },
      },
    );

    // Test basic connectivity first
    console.log("[DEBUG] Testing basic database connectivity...");
    const { data: testData, error: testError } = await supabaseAdmin
      .from("secrets")
      .select("count")
      .limit(1);

    console.log("[DEBUG] Basic connectivity test:");
    console.log("Test error:", testError);
    console.log("Test data:", testData);

    if (testError) {
      throw new Error(
        `Database connectivity test failed: ${testError.message}`,
      );
    }

    let from = 0;
    let totalProcessed = 0;
    let hasMore = true;
    // const results = [];

    // Process reminders in batches until no more are found
    while (hasMore) {
      const { processed, hasMore: moreReminders } = await processReminders(
        supabaseAdmin,
        from,
      );
      totalProcessed += processed;
      hasMore = moreReminders;
      from += BATCH_SIZE;

      // Add a small delay between batches to avoid rate limits
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100));
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
