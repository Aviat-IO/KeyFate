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
      headers: Object.fromEntries(request.headers.entries()),
    })

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

    const alreadyProcessed = await isWebhookProcessed(
      "btcpay",
      event.id || `btcpay-${Date.now()}`,
    )
    if (alreadyProcessed) {
      console.log("✅ BTCPay webhook already processed (replay detected)")
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Extract user ID from event metadata
    const userId = extractUserIdFromBTCPayEvent(event)

    if (!userId) {
      console.error("No user_id found in BTCPay webhook event metadata")
      await emailService.sendAdminAlert({
        type: "webhook_failure",
        severity: "medium",
        message: "BTCPay webhook missing user_id",
        details: {
          eventType: event.type,
          eventId: event.id || "unknown",
          provider: "btcpay",
        },
      })
      return NextResponse.json(
        { error: "No user_id in metadata" },
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
function extractUserIdFromBTCPayEvent(event: any): string | null {
  try {
    const eventData = event.data.object as Record<string, unknown>

    // Try to get user_id from metadata
    const metadata = eventData.metadata as Record<string, string> | undefined
    if (metadata?.user_id) {
      return metadata.user_id
    }

    return null
  } catch (error) {
    console.error("Error extracting user ID from BTCPay event:", error)
    return null
  }
}
