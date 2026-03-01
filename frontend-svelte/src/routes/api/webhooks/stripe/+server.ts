import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { getFiatPaymentProvider } from "$lib/payment"
import type { WebhookEvent } from "$lib/payment/interfaces/PaymentProvider"
import { serverEnv } from "$lib/server-env"
import { subscriptionService } from "$lib/services/subscription-service"
import { emailService } from "$lib/email/email-service"
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

    logger.info("Stripe webhook received", {
      type: webhookEvent.type,
      id: webhookEvent.id,
      created: webhookEvent.created,
    })

    const alreadyProcessed = await isWebhookProcessed("stripe", webhookEvent.id)
    if (alreadyProcessed) {
      logger.info("Webhook already processed (replay detected)", { eventId: webhookEvent.id })
      return json({ received: true, duplicate: true })
    }

    const eventData = webhookEvent.data.object as Record<string, unknown>
    logger.debug("Stripe event data", {
      dataKeys: Object.keys(eventData),
      hasMetadata: !!eventData.metadata,
      customerId: eventData.customer || "none",
      subscriptionField: eventData.subscription || "none",
    })

    // For invoices, also check parent.subscription_details
    if (webhookEvent.type.startsWith("invoice.")) {
      const parent = eventData.parent as Record<string, unknown> | undefined
      const subscriptionDetails = parent?.subscription_details as
        | Record<string, unknown>
        | undefined
      logger.debug("Invoice parent subscription details", {
        parentSubscriptionId: subscriptionDetails?.subscription || "none",
        parentMetadata: subscriptionDetails?.metadata || "none",
      })
    }

    // Extract user ID from event metadata
    const userId = await extractUserIdFromEvent(webhookEvent)

    if (!userId) {
      logger.error("No user_id found in webhook event metadata", undefined, {
        eventType: webhookEvent.type,
        eventId: webhookEvent.id || "unknown",
      })
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

    logger.info("Extracted user_id", { userId })

    // Handle event using subscription service
    await subscriptionService.handleStripeWebhook(webhookEvent, userId)

    await recordWebhookEvent("stripe", webhookEvent.id, webhookEvent.type, webhookEvent)

    return json({ received: true })
  } catch (error) {
    logger.error("Stripe webhook error", error instanceof Error ? error : undefined)

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

    logger.debug("Attempting to extract user_id from event", { eventType: event.type })

    // Try to get user_id from direct metadata (works for checkout.session.completed)
    const metadata = eventData.metadata as Record<string, string> | undefined
    if (metadata?.user_id) {
      logger.debug("Found user_id in direct metadata", { userId: metadata.user_id })
      return metadata.user_id
    }

    // For subscription events, check subscription object metadata
    if (event.type.startsWith("customer.subscription.")) {
      const subscriptionMetadata = eventData.metadata as
        | Record<string, string>
        | undefined
      if (subscriptionMetadata?.user_id) {
        logger.debug("Found user_id in subscription metadata", { userId: subscriptionMetadata.user_id })
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

      logger.debug("Invoice event subscription lookup", {
        subscriptionId: subscriptionId || "NOT FOUND",
      })

      if (subscriptionId) {
        try {
          const fiatPaymentProvider = getFiatPaymentProvider()
          const subscription =
            await fiatPaymentProvider.getSubscription(subscriptionId)
          if (subscription.metadata?.user_id) {
            logger.debug("Found user_id in fetched subscription", {
              userId: subscription.metadata.user_id,
            })
            return subscription.metadata.user_id
          } else {
            logger.debug("Subscription has no user_id in metadata", {
              metadataKeys: Object.keys(subscription.metadata || {}),
            })
          }
        } catch (error) {
          logger.error("Failed to fetch subscription from Stripe", error instanceof Error ? error : undefined, {
            subscriptionId,
          })
        }
      }
    }

    // Fallback: Look up user by subscription ID or customer ID in our database
    const subscriptionId = eventData.id as string | undefined
    const customerId = eventData.customer as string | undefined

    if (subscriptionId || customerId) {
      logger.debug("Falling back to database lookup", { subscriptionId, customerId })
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
            logger.debug("Found user_id via database lookup", { userId: subscription.userId })
            return subscription.userId
          }
        }
      } catch (dbError) {
        logger.error("Database lookup failed", dbError instanceof Error ? dbError : undefined)
      }
    }

    logger.warn("Could not find user_id in any metadata location", { eventType: event.type })
    return null
  } catch (error) {
    logger.error("Error extracting user ID from event", error instanceof Error ? error : undefined)
    return null
  }
}
