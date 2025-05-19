import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Secret } from "../../types.ts";
import { decrypt } from "../_shared/crypto.ts";
import { getSecretTriggerTemplate } from "../_shared/email-templates.ts";
import { API_URL, SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { Database } from "../../database.types.ts";

interface ProcessError extends Error {
  message: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch(`${API_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }
}

async function processSecret(
  secret: Secret,
  supabaseAdmin: ReturnType<typeof createClient<Database>>,
) {
  try {
    // Get user's email from user_contact_methods
    const { data: contactMethod } = await supabaseAdmin
      .from("user_contact_methods")
      .select("email")
      .eq("user_id", secret.user_id)
      .single();

    if (!contactMethod?.email) {
      throw new Error("User email not found");
    }

    if (!secret.server_share) {
      // Skip secrets where server share has been deleted - they are essentially disabled
      console.log(
        `Skipping secret ${secret.id} - server share has been deleted`,
      );
      return { id: secret.id, status: "skipped" };
    }

    if (!secret.iv || !secret.auth_tag) {
      throw new Error("Secret IV or auth tag not found");
    }

    // Decrypt the secret message
    const decryptedMessage = await decrypt(
      secret.server_share,
      secret.iv,
      secret.auth_tag,
    );

    // Prepare email content using the template
    const emailHtml = getSecretTriggerTemplate({
      recipientName: secret.recipient_name,
      senderEmail: contactMethod.email,
      secretTitle: secret.title,
      secretMessage: decryptedMessage,
    });

    // Send the email
    await sendEmail(
      secret.recipient_email!,
      `Important Message from ${contactMethod.email}`,
      emailHtml,
    );

    // Only update the secret status if the email was sent successfully
    await supabaseAdmin
      .from("secrets")
      .update({
        status: "triggered",
        is_triggered: true,
        triggered_at: new Date().toISOString(),
      })
      .eq("id", secret.id);

    return { id: secret.id, status: "triggered" };
  } catch (error) {
    const processError = error as ProcessError;
    console.error(
      `Error processing secret ${secret.id}:`,
      processError.message,
    );
    // Don't update the secret status on failure - it will be retried next time
    return {
      id: secret.id,
      status: "failed",
      error: processError.message,
    };
  }
}

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient<Database>(
      API_URL,
      SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    // Get secrets that need to be triggered (excluding those with deleted server shares)
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from("secrets")
      .select("*")
      .eq("status", "active")
      .eq("is_triggered", false)
      .not("server_share", "is", null)
      .lte("next_check_in", new Date().toISOString());

    if (secretsError) {
      throw new Error(`Failed to fetch secrets: ${secretsError.message}`);
    }

    if (!secrets || secrets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No secrets to process" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Process each secret
    const results = await Promise.all(
      secrets.map((secret) => processSecret(secret, supabaseAdmin)),
    );

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const processError = error as ProcessError;
    return new Response(
      JSON.stringify({ error: processError.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
