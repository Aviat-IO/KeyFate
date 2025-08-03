import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { getFiatPaymentProvider } from "@/lib/payment";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Handle GET requests for post-authentication redirects
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lookupKey = searchParams.get("lookup_key");
  const redirectAfterAuth = searchParams.get("redirect_after_auth");

  if (!lookupKey || !redirectAfterAuth) {
    return NextResponse.redirect(`${NEXT_PUBLIC_SITE_URL}/pricing`);
  }

  // This is a post-authentication redirect, create checkout session
  return createCheckoutSession(lookupKey);
}

export async function POST(request: NextRequest) {
  try {
    const { lookup_key } = await request.json();
    return createCheckoutSession(lookup_key);
  } catch (error) {
    console.error("Error parsing request body:", error);
    return NextResponse.json({ error: "Invalid request body" }, {
      status: 400,
    });
  }
}

async function createCheckoutSession(lookupKey: string) {
  try {
    console.log(`🔍 Creating checkout session for lookup key: ${lookupKey}`);

    // Get user from Supabase auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("❌ Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider();
    console.log("✅ Payment provider initialized");

    // Get or create customer
    let customerId: string;

    // Try to get existing subscription with Stripe customer ID
    // Handle case where Stripe columns might not exist yet
    try {
      const { data: existingSubscription } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Check if stripe_customer_id column exists and has a value
      if (
        existingSubscription && "stripe_customer_id" in existingSubscription &&
        existingSubscription.stripe_customer_id
      ) {
        customerId = existingSubscription.stripe_customer_id as string;
        console.log(`✅ Using existing customer: ${customerId}`);
      } else {
        // Create new customer
        console.log("🆕 Creating new Stripe customer...");
        customerId = await fiatPaymentProvider.createCustomer(user.email!, {
          user_id: user.id,
        });
        console.log(`✅ Created new customer: ${customerId}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // If column doesn't exist or other error, create new customer
      console.log("🆕 Creating new Stripe customer (fallback)...");
      customerId = await fiatPaymentProvider.createCustomer(user.email!, {
        user_id: user.id,
      });
      console.log(`✅ Created new customer (fallback): ${customerId}`);
    }

    // Get price by lookup key
    console.log("🔍 Fetching prices from Stripe...");
    const prices = await fiatPaymentProvider.listPrices();
    console.log(`✅ Found ${prices.length} prices`);

    const price = prices.find((p) => p.lookupKey === lookupKey);

    if (!price) {
      console.log(`❌ Price not found for lookup key: ${lookupKey}`);
      console.log(
        "Available lookup keys:",
        prices.map((p) => p.lookupKey).filter(Boolean),
      );
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    console.log(
      `✅ Found price: ${price.id} (${price.unitAmount} ${price.currency})`,
    );

    // Create checkout session
    console.log("🛒 Creating Stripe checkout session...");
    const sessionConfig = {
      customerId,
      priceId: price.id,
      mode: "subscription" as const,
      successUrl:
        `${NEXT_PUBLIC_SITE_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
      billingAddressCollection: "auto" as const,
      automaticTax: { enabled: false },
      // customerUpdate: {
      //   address: "auto",
      // },
      metadata: {
        user_id: user.id,
      },
    };

    console.log("Session config:", JSON.stringify(sessionConfig, null, 2));

    const session = await fiatPaymentProvider.createCheckoutSession(
      sessionConfig,
    );

    console.log(`✅ Checkout session created: ${session.id}`);
    console.log(`🔗 Redirecting to: ${session.url}`);

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Return more specific error information
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, {
      status: 500,
    });
  }
}
