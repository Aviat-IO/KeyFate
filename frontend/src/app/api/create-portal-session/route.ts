import { NEXT_PUBLIC_SITE_URL } from "@/lib/env";
import { getFiatPaymentProvider } from "@/lib/payment";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    // Get user from Supabase auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider();

    // Get customer ID from subscription
    // Handle case where Stripe columns might not exist yet
    try {
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Check if stripe_customer_id column exists and has a value
      if (
        !subscription || !("stripe_customer_id" in subscription) ||
        !subscription.stripe_customer_id
      ) {
        return NextResponse.json({
          error: "No Stripe subscription found. Please subscribe first.",
        }, { status: 404 });
      }

      // Create billing portal session
      const portalSession = await fiatPaymentProvider
        .createBillingPortalSession!(
          subscription.stripe_customer_id as string,
          `${NEXT_PUBLIC_SITE_URL}/profile`,
        );

      return NextResponse.redirect(portalSession.url, 303);
    } catch (error) {
      console.error("Error accessing subscription data:", error);
      return NextResponse.json({
        error: "Subscription not found or Stripe integration not available yet",
      }, { status: 404 });
    }
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json({ error: "Internal server error" }, {
      status: 500,
    });
  }
}
