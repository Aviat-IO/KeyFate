import { getCryptoPaymentProvider } from "@/lib/payment"
import { serverEnv } from "@/lib/server-env"
import { subscriptionService } from "@/lib/services/subscription-service"
import { emailService } from "@/lib/services/email-service"
import { NextRequest, NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("btcpay-sig")

    if (!signature) {
      console.error("BTCPay webhook missing signature header")
      return NextResponse.json(
        { error: "No signature provided" },
        {
          status: 400,
        },
      )
    }

    const cryptoPaymentProvider = getCryptoPaymentProvider()

    // Verify webhook signature
    const event = await cryptoPaymentProvider.verifyWebhookSignature(
      body,
      signature,
      serverEnv.BTCPAY_WEBHOOK_SECRET,
    )

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
