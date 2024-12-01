import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import sgMail from "npm:@sendgrid/mail";

import { Secret } from "../secret.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not set");
}

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
if (!SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
sgMail.setApiKey(SENDGRID_API_KEY);

const BATCH_SIZE = 100; // Adjust based on your needs
const MAX_PARALLEL_OPERATIONS = 5; // Adjust based on your needs

Deno.serve(async () => {
  try {
    const now = new Date();
    let processedCount = 0;
    let hasMore = true;

    while (hasMore) {
      // Get a batch of secrets that need processing
      const { data: triggeredSecrets, error } = await supabase
        .from("secrets")
        .select("*")
        .eq("is_active", true)
        .eq("is_triggered", false)
        .lt("next_check_in", now.toISOString())
        .order("next_check_in", { ascending: true })
        .limit(BATCH_SIZE);

      if (error) throw error;

      console.log("triggeredSecrets", triggeredSecrets.length);

      if (!triggeredSecrets || triggeredSecrets.length === 0) {
        hasMore = false;
        break;
      }

      // Process secrets in parallel batches
      const chunks = chunkArray(triggeredSecrets, MAX_PARALLEL_OPERATIONS);

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (secret) => {
          try {
            // Mark the secret as triggered
            await supabase
              .from("secrets")
              .update({
                is_triggered: true,
                triggered_at: now.toISOString(),
              })
              .eq("id", secret.id);

            await sendNotifications(secret);

            processedCount++;
          } catch (error) {
            console.error(`Failed to process secret ${secret.id}:`, error);
            // You might want to log this error to a monitoring service
          }
        }));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }, null, 2),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});

// Helper function to chunk array into smaller arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function sendEmail(to: string, subject: string, content: string) {
  const msg: sgMail.MailDataRequired = {
    to,
    from: "alerts@keyfate.com",
    subject,
    content: [{
      type: "text/plain",
      value: content,
    }],
  };

  const [res, error] = await sgMail.send(msg);
  console.log("sendEmail res", res, error);
  if (error) {
    throw error;
  }
}

async function sendSecretEmail(secret: Secret) {
  if (!secret.recipient_email) {
    console.log("no recipient email", secret.id);
    return;
  }

  const content = `${secret.title}\n\n${secret.message}`;
  await sendEmail(
    secret.recipient_email,
    `${secret.recipient_name} - You've received a secret from a friend on KeyFate`,
    content,
  );
}

async function sendNotifications(secret: Secret) {
  console.log("sending notifications", secret);

  if (secret.recipient_email) {
    await sendSecretEmail(secret);
  }

  if (secret.recipient_phone) {
    await sendSecretSMS(secret);
  }
}

function sendSecretSMS(secret: Secret) {
  // TODO: Implement SMS sending
  console.log("sending secret SMS", secret);
}
