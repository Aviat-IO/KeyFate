import { getFiatPaymentProvider } from "@/lib/payment";
import type { WebhookEvent } from "@/lib/payment/interfaces/PaymentProvider";
import { serverEnv } from "@/lib/server-env";
import { subscriptionService } from "@/lib/services/subscription-service";
import { emailService } from "@/lib/services/email-service";
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

    // Extract user ID from event metadata
    const userId = extractUserIdFromEvent(event);

    if (!userId) {
      console.error("No user_id found in webhook event metadata");
      await emailService.sendAdminAlert({
        type: "webhook_failure",
        severity: "medium",
        message: "Stripe webhook missing user_id",
        details: {
          eventType: event.type,
          eventId: event.id || "unknown",
          provider: "stripe",
        },
      });
      return NextResponse.json({ error: "No user_id in metadata" }, { status: 400 });
    }

    // Handle event using subscription service
    await subscriptionService.handleStripeWebhook(event, userId);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    // Send admin alert for webhook failures
    await emailService.sendAdminAlert({
      type: "webhook_failure",
      severity: "high",
      message: "Stripe webhook processing failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        provider: "stripe",
        timestamp: new Date().toISOString(),
      },
    });

    // Determine error type for appropriate response
    if (error instanceof Error && error.message.includes("Invalid webhook signature")) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}

// Helper function to extract user ID from webhook event
function extractUserIdFromEvent(event: WebhookEvent): string | null {
  try {
    const eventData = event.data.object as Record<string, unknown>;

    // Try to get user_id from metadata
    const metadata = eventData.metadata as Record<string, string> | undefined;
    if (metadata?.user_id) {
      return metadata.user_id;
    }

    // For invoice events, try to get from subscription metadata
    if (event.type.startsWith("invoice.")) {
      const subscriptionId = eventData.subscription as string;
      if (subscriptionId) {
        // Note: In a real implementation, you'd need to fetch the subscription
        // from Stripe to get its metadata. For now, we'll try other approaches.
        console.warn(`Invoice event ${event.type} missing user_id in metadata, subscription: ${subscriptionId}`);
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting user ID from event:", error);
    return null;
  }
}
