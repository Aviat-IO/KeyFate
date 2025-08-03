import { getFiatPaymentProvider } from "@/lib/payment";
import type { WebhookEvent } from "@/lib/payment/interfaces/PaymentProvider";
import { serverEnv } from "@/lib/server-env";
import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature provided" }, {
        status: 400,
      });
    }

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider();

    // Verify webhook signature
    const event = await fiatPaymentProvider.verifyWebhookSignature(
      body,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    );

    const supabase = await createClient();

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event, supabase);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event, supabase);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, {
      status: 400,
    });
  }
}

async function handleSubscriptionChange(
  event: WebhookEvent,
  supabase: SupabaseClient,
) {
  const subscription = event.data.object as Record<string, unknown>;
  const customerId = subscription.customer as string;
  const userId = (subscription.metadata as Record<string, string>)?.user_id;

  if (!userId) {
    console.error("No user_id in subscription metadata");
    return;
  }

  // Determine tier based on price
  const items = subscription.items as {
    data: Array<{ price: { id: string } }>;
  };
  const priceId = items.data[0].price.id;
  const tier = getTierFromPriceId(priceId);

  // Upsert subscription record
  await supabase
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id as string,
      status: subscription.status as string,
      current_period_start: new Date(
        (subscription.current_period_start as number) * 1000,
      ),
      current_period_end: new Date(
        (subscription.current_period_end as number) * 1000,
      ),
      cancel_at_period_end: subscription.cancel_at_period_end as boolean,
      tier_name: tier.name,
    });

  console.log(`Subscription ${subscription.status} for user ${userId}`);
}

async function handleSubscriptionCanceled(
  event: WebhookEvent,
  supabase: SupabaseClient,
) {
  const subscription = event.data.object as Record<string, unknown>;
  const userId = (subscription.metadata as Record<string, string>)?.user_id;

  if (!userId) {
    console.error("No user_id in subscription metadata");
    return;
  }

  // Update subscription to canceled status
  await supabase
    .from("user_subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date(),
    })
    .eq("stripe_subscription_id", subscription.id as string);

  console.log(`Subscription canceled for user ${userId}`);
}

async function handlePaymentSucceeded(event: WebhookEvent) {
  const invoice = event.data.object as Record<string, unknown>;
  const subscriptionId = invoice.subscription as string;

  // Log successful payment
  console.log(`Payment succeeded for subscription ${subscriptionId}`);

  // Could update payment history table here
}

async function handlePaymentFailed(event: WebhookEvent) {
  const invoice = event.data.object as Record<string, unknown>;
  const subscriptionId = invoice.subscription as string;

  // Log failed payment
  console.log(`Payment failed for subscription ${subscriptionId}`);

  // Could send notification email here
}

async function handleTrialWillEnd(event: WebhookEvent) {
  const subscription = event.data.object as Record<string, unknown>;
  const userId = (subscription.metadata as Record<string, string>)?.user_id;

  console.log(`Trial will end for user ${userId}`);

  // Could send trial ending notification here
}

function getTierFromPriceId(priceId: string) {
  // Map price IDs to tiers - this should match your Stripe product setup
  const priceToTierMap: Record<string, { name: "free" | "pro"; id: string }> = {
    price_pro_monthly: { name: "pro", id: "pro" },
    price_pro_yearly: { name: "pro", id: "pro" },
  };

  return priceToTierMap[priceId] || { name: "free" as const, id: "free" };
}
