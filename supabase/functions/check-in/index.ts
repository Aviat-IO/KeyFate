import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { API_URL, SERVICE_ROLE_KEY, SITE_URL } from "../_shared/env.ts";
import { Database } from "../_shared/types.ts";

class CheckInError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CheckInError";
    this.code = code;
  }
}

async function handleCheckIn(token: string) {
  const supabaseAdmin = createClient<Database>(
    API_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );

  // Get and validate token
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from("check_in_tokens")
    .select("id, secret_id, used_at, expires_at")
    .eq("token", token)
    .single();

  if (tokenError || !tokenData) {
    throw new CheckInError("Invalid or expired token");
  }

  if (tokenData.used_at) {
    throw new CheckInError("Token has already been used", "TOKEN_USED");
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    throw new CheckInError("Token has expired", "TOKEN_EXPIRED");
  }

  // Get secret details
  const { data: secret, error: secretError } = await supabaseAdmin
    .from("secrets")
    .select("title, check_in_days")
    .eq("id", tokenData.secret_id)
    .single();

  if (secretError || !secret) {
    throw new CheckInError("Secret not found");
  }

  // Mark token as used
  const { error: updateTokenError } = await supabaseAdmin
    .from("check_in_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenData.id);

  if (updateTokenError) {
    throw new CheckInError("Failed to update token");
  }

  // Update secret's next check-in
  const now = new Date().toISOString();
  const nextCheckIn = new Date();
  nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

  const { error: updateSecretError } = await supabaseAdmin
    .from("secrets")
    .update({
      next_check_in: nextCheckIn.toISOString(),
      last_check_in: now,
    })
    .eq("id", tokenData.secret_id);

  if (updateSecretError) {
    throw new CheckInError("Failed to update secret");
  }

  return {
    secretTitle: secret.title,
    nextCheckIn: nextCheckIn.toLocaleString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Missing token",
          redirect: `${SITE_URL}/auth/login?next=/dashboard`,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const result = await handleCheckIn(token);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    const checkInError = error as CheckInError;
    console.error("Error processing check-in:", checkInError);

    // If token is expired or used, redirect to sign in
    if (
      checkInError.code === "TOKEN_EXPIRED" ||
      checkInError.code === "TOKEN_USED"
    ) {
      return new Response(
        JSON.stringify({
          error: checkInError.message,
          redirect: `${SITE_URL}/auth/login?next=/dashboard`,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({ error: checkInError.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
