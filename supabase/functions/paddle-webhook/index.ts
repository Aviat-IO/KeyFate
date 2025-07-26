import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Database } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status?: string;
    customer_id?: string;
    subscription_id?: string;
    custom_data?: Record<string, any>;
    [key: string]: any;
  };
}

// Verify webhook signature
async function verifyWebhook(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    return await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      payloadData,
    );
  } catch (error) {
    console.error("Webhook verification error:", error);
    return false;
  }
}

// Process subscription events
async function processSubscriptionEvent(
  supabase: ReturnType<typeof createClient<Database>>,
  event: PaddleWebhookEvent,
) {
  const { event_type, data } = event;

  console.log(`Processing ${event_type} for subscription ${data.id}`);

  switch (event_type) {
    case "subscription.created":
      await handleSubscriptionCreated(supabase, data);
      break;
    case "subscription.updated":
      await handleSubscriptionUpdated(supabase, data);
      break;
    case "subscription.canceled":
      await handleSubscriptionCanceled(supabase, data);
      break;
    case "transaction.completed":
      await handleTransactionCompleted(supabase, data);
      break;
    case "subscription.paused":
      await handleSubscriptionPaused(supabase, data);
      break;
    case "subscription.resumed":
      await handleSubscriptionResumed(supabase, data);
      break;
    default:
      console.log(`Unhandled event type: ${event_type}`);
  }
}

async function handleSubscriptionCreated(
  supabase: ReturnType<typeof createClient<Database>>,
  data: any,
) {
  const userId = data.custom_data?.user_id;
  if (!userId) {
    throw new Error("No user_id in subscription custom_data");
  }

  // Get tier from custom data or determine from items
  const tierName = data.custom_data?.tier || determineTierFromItems(data.items);

  // Create or update subscription record
  const { error: subscriptionError } = await supabase
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customer_id,
      status: data.status,
      tier_name: tierName,
      current_period_start: data.current_billing_period?.starts_at,
      current_period_end: data.current_billing_period?.ends_at,
      cancel_at_period_end: data.scheduled_change?.action === "cancel",
    });

  if (subscriptionError) {
    throw subscriptionError;
  }

  // Update user tier
  await updateUserTier(supabase, userId, tierName);
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient<Database>>,
  data: any,
) {
  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      status: data.status,
      current_period_start: data.current_billing_period?.starts_at,
      current_period_end: data.current_billing_period?.ends_at,
      cancel_at_period_end: data.scheduled_change?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id);

  if (error) {
    throw error;
  }
}

async function handleSubscriptionCanceled(
  supabase: ReturnType<typeof createClient<Database>>,
  data: any,
) {
  // Update subscription status
  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id);

  if (error) {
    throw error;
  }

  // Downgrade user to free tier
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("paddle_subscription_id", data.id)
    .single();

  if (subscription) {
    await updateUserTier(supabase, subscription.user_id, "free");
  }
}

async function handleSubscriptionPaused(
  supabase: ReturnType<typeof createClient<Database>>,
  data: any,
) {
  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id);

  if (error) {
    throw error;
  }
}

async function handleSubscriptionResumed(
  supabase: ReturnType<typeof createClient<Database>>,
  data: any,
) {
  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id);

  if (error) {
    throw error;
  }
}

async function handleTransactionCompleted(
  supabase: ReturnType<typeof createClient<Database>>,
  data: any,
) {
  // Handle successful payments
  console.log(`Transaction ${data.id} completed successfully`);

  // You could log successful transactions or update payment history here
  // For now, just log the event
}

async function updateUserTier(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  tierName: string,
) {
  const tierLimits = getTierLimits(tierName);

  const { error } = await supabase
    .from("user_tiers")
    .upsert({
      user_id: userId,
      tier_name: tierName as any,
      max_secrets: tierLimits.maxSecrets,
      max_recipients_per_secret: tierLimits.maxRecipientsPerSecret,
      custom_intervals: tierLimits.customIntervals,
    });

  if (error) {
    throw error;
  }

  // Recalculate usage
  await supabase.rpc("calculate_user_usage", { p_user_id: userId });
}

function determineTierFromItems(items: any[]): string {
  // Logic to determine tier from Paddle subscription items
  // This would map price IDs to tiers
  // For now, default to pro
  return "pro";
}

function getTierLimits(tierName: string) {
  const limits = {
    free: { maxSecrets: 1, maxRecipientsPerSecret: 1, customIntervals: false },
    pro: { maxSecrets: 10, maxRecipientsPerSecret: 5, customIntervals: true },
  };

  return limits[tierName as keyof typeof limits] || limits.free;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("PADDLE_WEBHOOK_SECRET not configured");
    }

    const payload = await req.text();
    const signature = req.headers.get("paddle-signature");

    if (!signature) {
      throw new Error("Missing paddle-signature header");
    }

    // Verify webhook signature
    const isValid = await verifyWebhook(payload, signature, webhookSecret);
    if (!isValid) {
      throw new Error("Invalid webhook signature");
    }

    const event: PaddleWebhookEvent = JSON.parse(payload);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Process the event
    await processSubscriptionEvent(supabase, event);

    return new Response(
      JSON.stringify({ success: true, event_id: event.event_id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Webhook processing error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
