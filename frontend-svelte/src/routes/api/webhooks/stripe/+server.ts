import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getFiatPaymentProvider } from "$lib/payment"
import type { WebhookEvent } from "$lib/payment/interfaces/PaymentProvider"
import { serverEnv } from "$lib/server-env"
import { subscriptionService } from "$lib/services/subscription-service"
import { emailService } from "$lib/services/email-service"
import {
  isWebhookProcessed,
  recordWebhookEvent,
} from "$lib/webhooks/deduplication"
import { getDatabase } from "$lib/db/drizzle"
import { userSubscriptions } from "$lib/db/schema"
import { eq, or } from "drizzle-orm"

export const POST: RequestHandler = async (event) => {
  try {
    const body = await event.request.text()
    const signature = event.request.headers.get("stripe-signature")

    if (!signature) {
      return json(
        { error: "No signature provided" },
        { status: 400 },
      )
    }

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider()

    // Verify webhook signature
    const webhookEvent = await fiatPaymentProvider.verifyWebhookSignature(
      body,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    )

    console.log("Stripe webhook received:", {
      type: webhookEvent.type,
      id: webhookEvent.id,
      created: webhookEvent.created,
    })

    const alreadyProcessed = await isWebhookProcessed("stripe", webhookEvent.id)
    if (alreadyProcessed) {
      console.log("Webhook already processed (replay detected):", webhookEvent.id)
      return json({ received: true, duplicate: true })
    }

    const eventData = webhookEvent.data.object as Record<string, unknown>
    console.log("Event data keys:", Object.keys(eventData))
    console.log("Event metadata:", eventData.metadata)
    console.log("Customer ID:", eventData.customer || "none")
    console.log(
      "Direct subscription field:",
      eventData.subscription || "none",
    )

    // For invoices, also check parent.subscription_details
    if (webhookEvent.type.startsWith("invoice.")) {
      const parent = eventData.parent as Record<string, unknown> | undefined
      const subscriptionDetails = parent?.subscription_details as
        | Record<string, unknown>
        | undefined
      console.log(
        "Parent subscription ID:",
        subscriptionDetails?.subscription || "none",
      )
      console.log(
        "Parent subscription metadata:",
        subscriptionDetails?.metadata || "none",
      )
    }

    // Extract user ID from event metadata
    const userId = await extractUserIdFromEvent(webhookEvent)

    if (!userId) {
      console.error("No user_id found in webhook event metadata")
      console.error(
        "Full event data object:",
        JSON.stringify(eventData, null, 2),
      )
      await emailService.sendAdminAlert({
        type: "webhook_failure",
        severity: "medium",
        message: "Stripe webhook missing user_id",
        details: {
          eventType: webhookEvent.type,
          eventId: webhookEvent.id || "unknown",
          provider: "stripe",
          metadata: eventData.metadata,
        },
      })
      return json(
        { error: "No user_id in metadata" },
        { status: 400 },
      )
    }

    console.log("Extracted user_id:", userId)

    // Handle event using subscription service
    await subscriptionService.handleStripeWebhook(webhookEvent, userId)

    await recordWebhookEvent("stripe", webhookEvent.id, webhookEvent.type, webhookEvent)

    return json({ received: true })
  } catch (error) {
    console.error("Stripe webhook error:", error)

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
    })

    // Determine error type for appropriate response
    if (
      error instanceof Error &&
      error.message.includes("Invalid webhook signature")
    ) {
      return json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      )
    }

    return json(
      { error: "Webhook processing failed" },
      { status: 400 },
    )
  }
}

// Helper function to extract user ID from webhook event
async function extractUserIdFromEvent(
  event: WebhookEvent,
): Promise<string | null> {
  try {
    const eventData = event.data.object as Record<string, unknown>

    console.log("Attempting to extract user_id from event type:", event.type)

    // Try to get user_id from direct metadata (works for checkout.session.completed)
    const metadata = eventData.metadata as Record<string, string> | undefined
    console.log("  Direct metadata:", metadata)
    if (metadata?.user_id) {
      console.log("  Found user_id in direct metadata:", metadata.user_id)
      return metadata.user_id
    }

    // For subscription events, check subscription object metadata
    if (event.type.startsWith("customer.subscription.")) {
      console.log(
        "  This is a subscription event, checking subscription metadata",
      )
      const subscriptionMetadata = eventData.metadata as
        | Record<string, string>
        | undefined
      console.log("  Subscription metadata:", subscriptionMetadata)
      if (subscriptionMetadata?.user_id) {
        console.log(
          "  Found user_id in subscription metadata:",
          subscriptionMetadata.user_id,
        )
        return subscriptionMetadata.user_id
      }
    }

    // For invoice events, fetch the subscription to get metadata
    if (event.type.startsWith("invoice.")) {
      // Try direct subscription field first
      let subscriptionId = eventData.subscription as string

      // If not found, check parent.subscription_details.subscription
      if (!subscriptionId) {
        const parent = eventData.parent as Record<string, unknown> | undefined
        const subscriptionDetails = parent?.subscription_details as
          | Record<string, unknown>
          | undefined
        subscriptionId = subscriptionDetails?.subscription as string
      }

      console.log(
        `  Invoice event subscription ID: ${subscriptionId || "NOT FOUND"}`,
      )

      if (subscriptionId) {
        console.log(
          `  Fetching subscription ${subscriptionId} from Stripe API...`,
        )
        try {
          const fiatPaymentProvider = getFiatPaymentProvider()
          const subscription =
            await fiatPaymentProvider.getSubscription(subscriptionId)
          console.log(
            "  Full subscription object:",
            JSON.stringify(subscription, null, 2),
          )
          console.log("  Subscription metadata:", subscription.metadata)
          if (subscription.metadata?.user_id) {
            console.log(
              "  Found user_id in fetched subscription:",
              subscription.metadata.user_id,
            )
            return subscription.metadata.user_id
          } else {
            console.log(
              "  Subscription has NO user_id in metadata (metadata keys:",
              Object.keys(subscription.metadata || {}),
              ")",
            )
          }
        } catch (error) {
          console.error("  Failed to fetch subscription:", error)
          if (error instanceof Error) {
            console.error("  Error details:", error.message)
          }
        }
      } else {
        console.log("  No subscription ID found in invoice event")
      }
    }

    // Fallback: Look up user by subscription ID or customer ID in our database
    const subscriptionId = eventData.id as string | undefined
    const customerId = eventData.customer as string | undefined

    if (subscriptionId || customerId) {
      console.log(
        `  Falling back to database lookup (subscriptionId: ${subscriptionId}, customerId: ${customerId})`,
      )
      try {
        const db = await getDatabase()
        const conditions = []

        if (subscriptionId && event.type.startsWith("customer.subscription.")) {
          conditions.push(
            eq(userSubscriptions.providerSubscriptionId, subscriptionId),
          )
        }
        if (customerId) {
          conditions.push(eq(userSubscriptions.providerCustomerId, customerId))
        }

        if (conditions.length > 0) {
          const [subscription] = await db
            .select({ userId: userSubscriptions.userId })
            .from(userSubscriptions)
            .where(conditions.length === 1 ? conditions[0] : or(...conditions))
            .limit(1)

          if (subscription?.userId) {
            console.log(
              "  Found user_id via database lookup:",
              subscription.userId,
            )
            return subscription.userId
          }
        }
      } catch (dbError) {
        console.error("  Database lookup failed:", dbError)
      }
    }

    console.log("  Could not find user_id in any metadata location")
    return null
  } catch (error) {
    console.error("Error extracting user ID from event:", error)
    return null
  }
}
