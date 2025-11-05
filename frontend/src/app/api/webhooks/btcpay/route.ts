import { getCryptoPaymentProvider } from "@/lib/payment"
import { serverEnv } from "@/lib/server-env"
import { subscriptionService } from "@/lib/services/subscription-service"
import { emailService } from "@/lib/services/email-service"
import {
  isWebhookProcessed,
  recordWebhookEvent,
} from "@/lib/webhooks/deduplication"
import { NextRequest, NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("btcpay-sig")

    console.log("📨 BTCPay webhook received:", {
      hasSignature: !!signature,
      signaturePrefix: signature?.substring(0, 20),
      bodyLength: body.length,
    })

    // Log raw payload for debugging
    console.log("📄 Raw webhook payload:", body)

    if (!signature) {
      console.error("BTCPay webhook missing signature header")
      return NextResponse.json(
        { error: "No signature provided" },
        {
          status: 400,
        },
      )
    }

    // Check if webhook secret is configured
    if (!serverEnv.BTCPAY_WEBHOOK_SECRET) {
      console.error("❌ BTCPAY_WEBHOOK_SECRET not configured")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        {
          status: 500,
        },
      )
    }

    const cryptoPaymentProvider = getCryptoPaymentProvider()

    // Verify webhook signature
    console.log("🔐 Verifying BTCPay webhook signature...")
    const event = await cryptoPaymentProvider.verifyWebhookSignature(
      body,
      signature,
      serverEnv.BTCPAY_WEBHOOK_SECRET,
    )
    console.log("✅ Signature verified successfully")

    // Log event structure for debugging
    console.log("📦 BTCPay event structure:", {
      type: event.type,
      id: event.id,
      dataKeys: Object.keys(event.data || {}),
      hasObject: !!(event.data as any)?.object,
      objectKeys:
        (event.data as any)?.object && Object.keys((event.data as any).object),
    })

    const alreadyProcessed = await isWebhookProcessed(
      "btcpay",
      event.id || `btcpay-${Date.now()}`,
    )
    if (alreadyProcessed) {
      console.log("✅ BTCPay webhook already processed (replay detected)")
      return NextResponse.json({ received: true, duplicate: true })
    }

    // BTCPay webhooks don't include full invoice data, just the ID
    // We need to fetch the invoice to get metadata
    const rawEvent = JSON.parse(body)
    const invoiceId = rawEvent.invoiceId

    console.log("📋 BTCPay webhook invoiceId:", invoiceId)

    // Detect test webhooks from BTCPay UI
    const isTestWebhook =
      invoiceId?.includes("__test__") ||
      rawEvent.originalDeliveryId?.includes("__test__") ||
      event.type.includes("Test")

    if (isTestWebhook) {
      console.log("✅ Test webhook received and verified successfully")
      return NextResponse.json({
        received: true,
        test: true,
        message: "Test webhook verified successfully",
      })
    }

    // Extract user ID from event metadata
    const userId = await extractUserIdFromBTCPayEvent(event, invoiceId)

    if (!userId) {
      console.warn("⚠️ No user_id found in BTCPay webhook event metadata")
      console.log("📋 Event data:", JSON.stringify(event.data, null, 2))

      // For real webhooks, this is an error
      console.error("❌ Real webhook missing user_id in metadata")
      await emailService.sendAdminAlert({
        type: "webhook_failure",
        severity: "medium",
        message: "BTCPay webhook missing user_id",
        details: {
          eventType: event.type,
          eventId: event.id || "unknown",
          provider: "btcpay",
          eventData: event.data,
        },
      })
      return NextResponse.json(
        {
          error: "No user_id in metadata",
          eventType: event.type,
          hint: "user_id should be in invoice metadata",
        },
        { status: 400 },
      )
    }

    // Handle event using subscription service
    await subscriptionService.handleBTCPayWebhook(event, userId)

    await recordWebhookEvent(
      "btcpay",
      event.id || `btcpay-${Date.now()}`,
      event.type,
      event,
    )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("BTCPay webhook error:", error)

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
      return NextResponse.json(
        {
          error: "Invalid webhook signature",
          details: error.message,
        },
        {
          status: 401,
        },
      )
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid JSON payload",
        },
        {
          status: 400,
        },
      )
    }

    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      },
    )
  }
}

// Helper function to extract user ID from BTCPay webhook event
async function extractUserIdFromBTCPayEvent(
  event: any,
  invoiceId: string | null,
): Promise<string | null> {
  try {
    console.log("🔍 Extracting user_id from BTCPay event...")

    // BTCPay webhooks don't include full invoice data in the webhook payload
    // We need to fetch the invoice using the invoiceId to get metadata
    if (invoiceId) {
      console.log("📞 Fetching invoice from BTCPay API:", invoiceId)
      try {
        const cryptoPaymentProvider = getCryptoPaymentProvider()
        const invoice = await (cryptoPaymentProvider as any).getInvoice(
          invoiceId,
        )
        console.log("✅ Invoice fetched successfully")
        console.log("📋 Invoice metadata:", invoice.metadata)

        if (invoice.metadata?.user_id) {
          console.log(
            "✅ Found user_id in invoice metadata:",
            invoice.metadata.user_id,
          )
          return invoice.metadata.user_id
        }
      } catch (error) {
        console.error("❌ Error fetching invoice from BTCPay:", error)
      }
    }

    // Fallback: try to extract from event data (for backwards compatibility)
    console.log("🔍 Trying event.data as fallback...")
    let eventData = event.data?.object as Record<string, unknown> | undefined

    if (!eventData && event.data) {
      eventData = event.data as Record<string, unknown>
    }

    if (eventData) {
      const metadata = eventData.metadata as Record<string, string> | undefined
      if (metadata?.user_id) {
        console.log("✅ Found user_id in event metadata:", metadata.user_id)
        return metadata.user_id
      }
    }

    console.log("❌ No user_id found in invoice or event")
    return null
  } catch (error) {
    console.error("Error extracting user ID from BTCPay event:", error)
    return null
  }
}
