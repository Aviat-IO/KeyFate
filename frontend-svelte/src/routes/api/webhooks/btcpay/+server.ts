import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { getCryptoPaymentProvider } from "$lib/payment"
import type { BTCPayProvider } from "$lib/payment/providers/BTCPayProvider"
import { serverEnv } from "$lib/server-env"
import { subscriptionService } from "$lib/services/subscription-service"
import { emailService } from "$lib/email/email-service"
import {
  isWebhookProcessed,
  recordWebhookEvent,
} from "$lib/webhooks/deduplication"

export const POST: RequestHandler = async (event) => {
  try {
    const body = await event.request.text()
    const signature = event.request.headers.get("btcpay-sig")

    logger.info("BTCPay webhook received", {
      hasSignature: !!signature,
      bodyLength: body.length,
    })

    if (!signature) {
      logger.error("BTCPay webhook missing signature header")
      return json(
        { error: "No signature provided" },
        { status: 400 },
      )
    }

    // Check if webhook secret is configured
    if (!serverEnv.BTCPAY_WEBHOOK_SECRET) {
      logger.error("BTCPAY_WEBHOOK_SECRET not configured")
      return json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      )
    }

    const cryptoPaymentProvider = getCryptoPaymentProvider()

    // Verify webhook signature
    const webhookEvent = await cryptoPaymentProvider.verifyWebhookSignature(
      body,
      signature,
      serverEnv.BTCPAY_WEBHOOK_SECRET,
    )

    logger.info("BTCPay webhook signature verified", {
      type: webhookEvent.type,
      id: webhookEvent.id,
    })

    const alreadyProcessed = await isWebhookProcessed(
      "btcpay",
      webhookEvent.id || `btcpay-${Date.now()}`,
    )
    if (alreadyProcessed) {
      logger.info("BTCPay webhook already processed (replay detected)")
      return json({ received: true, duplicate: true })
    }

    // BTCPay webhooks don't include full invoice data, just the ID
    // We need to fetch the invoice to get metadata
    const rawEvent = JSON.parse(body)
    const invoiceId = rawEvent.invoiceId

    logger.debug("BTCPay webhook invoiceId", { invoiceId })

    // Detect test webhooks from BTCPay UI
    const isTestWebhook =
      invoiceId?.includes("__test__") ||
      rawEvent.originalDeliveryId?.includes("__test__") ||
      webhookEvent.type.includes("Test")

    if (isTestWebhook) {
      logger.info("Test webhook received and verified successfully")
      return json({
        received: true,
        test: true,
        message: "Test webhook verified successfully",
      })
    }

    // Extract user ID from event metadata
    const userId = await extractUserIdFromBTCPayEvent(webhookEvent, invoiceId)

    if (!userId) {
      logger.error("No user_id found in BTCPay webhook event metadata", undefined, {
        eventType: webhookEvent.type,
        eventId: webhookEvent.id || "unknown",
      })
      await emailService.sendAdminAlert({
        type: "webhook_failure",
        severity: "medium",
        message: "BTCPay webhook missing user_id",
        details: {
          eventType: webhookEvent.type,
          eventId: webhookEvent.id || "unknown",
          provider: "btcpay",
          eventData: webhookEvent.data,
        },
      })
      return json(
        {
          error: "No user_id in metadata",
          eventType: webhookEvent.type,
          hint: "user_id should be in invoice metadata",
        },
        { status: 400 },
      )
    }

    // Handle event using subscription service
    await subscriptionService.handleBTCPayWebhook(webhookEvent, userId)

    await recordWebhookEvent(
      "btcpay",
      webhookEvent.id || `btcpay-${Date.now()}`,
      webhookEvent.type,
      webhookEvent,
    )

    return json({ received: true })
  } catch (error) {
    logger.error("BTCPay webhook error", error instanceof Error ? error : undefined)

    // Send admin alert for webhook failures
    await emailService.sendAdminAlert({
      type: "webhook_failure",
      severity: "high",
      message: "BTCPay webhook processing failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        provider: "btcpay",
        timestamp: new Date().toISOString(),
      },
    })

    // Provide more specific error responses
    if (
      error instanceof Error &&
      error.message.includes("Invalid webhook signature")
    ) {
      return json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      )
    }

    if (error instanceof SyntaxError) {
      return json(
        {
          error: "Invalid JSON payload",
        },
        { status: 400 },
      )
    }

    return json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }
}

// Helper function to extract user ID from BTCPay webhook event
async function extractUserIdFromBTCPayEvent(
  event: any,
  invoiceId: string | null,
): Promise<string | null> {
  try {
    logger.debug("Extracting user_id from BTCPay event")

    // BTCPay webhooks don't include full invoice data in the webhook payload
    // We need to fetch the invoice using the invoiceId to get metadata
    if (invoiceId) {
      try {
        const cryptoPaymentProvider = getCryptoPaymentProvider()
        const invoice = await (cryptoPaymentProvider as unknown as BTCPayProvider).getInvoice(
          invoiceId,
        )

        if (invoice.metadata?.user_id) {
          const uid = invoice.metadata.user_id
          if (typeof uid === "string") {
            logger.debug("Found user_id in invoice metadata", { userId: uid })
            return uid
          }
        }
      } catch (error) {
        logger.error("Error fetching invoice from BTCPay", error instanceof Error ? error : undefined, { invoiceId })
      }
    }

    // Fallback: try to extract from event data (for backwards compatibility)
    let eventData = event.data?.object as Record<string, unknown> | undefined

    if (!eventData && event.data) {
      eventData = event.data as Record<string, unknown>
    }

    if (eventData) {
      const metadata = eventData.metadata as Record<string, string> | undefined
      if (metadata?.user_id) {
        logger.debug("Found user_id in event metadata", { userId: metadata.user_id })
        return metadata.user_id
      }
    }

    logger.warn("No user_id found in invoice or event")
    return null
  } catch (error) {
    logger.error("Error extracting user ID from BTCPay event", error instanceof Error ? error : undefined)
    return null
  }
}
