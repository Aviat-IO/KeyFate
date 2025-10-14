# BTCPay Server Integration Guide for KeyFate

## Overview

This guide details the integration of BTCPay Server for Bitcoin and Lightning Network payments in the KeyFate platform. BTCPay Server provides a self-hosted, censorship-resistant payment processor that complements the Stripe integration for users who prefer cryptocurrency payments.

Based on the [BTCPay Server Development Documentation](https://docs.btcpayserver.org/Development/), this integration leverages the Greenfield API for seamless Bitcoin payment processing.

## BTCPay Server Architecture

BTCPay Server consists of several components:

- **BTCPay Server**: Main application for payment processing
- **NBXplorer**: Lightweight block explorer for tracking payments
- **Bitcoin Core**: Full Bitcoin node
- **PostgreSQL**: Database for storing payment data
- **Lightning Network**: Optional for instant payments (CLN or LND)

## Environment Variables

```bash
# .env.local
BTCPAY_SERVER_URL=https://your-btcpay-server.com
BTCPAY_API_KEY=your-api-key
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=your-webhook-secret

# For production
BTCPAY_SERVER_URL=https://your-production-btcpay.com
BTCPAY_API_KEY=your-production-api-key
BTCPAY_STORE_ID=your-production-store-id
BTCPAY_WEBHOOK_SECRET=your-production-webhook-secret
```

## BTCPay Provider Implementation

```typescript
// lib/payment/providers/BTCPayProvider.ts
import {
  PaymentProvider,
  Customer,
  Subscription,
  CheckoutConfig,
  CheckoutSession,
  BillingPortalSession,
  WebhookEvent,
  Product,
  Price,
  SubscriptionUpdate,
  SubscriptionConfig,
  Payment,
  PaymentConfig,
} from "../interfaces/PaymentProvider"

export interface BTCPayConfig {
  serverUrl: string
  apiKey: string
  storeId: string
}

export interface BTCPayInvoice {
  id: string
  storeId: string
  amount: string
  currency: string
  type: string
  checkoutLink: string
  status: string
  additionalStatus: string
  createdTime: string
  expirationTime: string
  monitoringExpiration: string
  metadata: Record<string, any>
}

export interface BTCPayWebhookEvent {
  deliveryId: string
  webhookId: string
  originalDeliveryId: string
  isRedelivery: boolean
  type: string
  timestamp: string
  storeId: string
  invoiceId: string
  data: any
}

export class BTCPayProvider implements PaymentProvider {
  private config: BTCPayConfig
  private baseUrl: string

  constructor(config: BTCPayConfig) {
    this.config = config
    this.baseUrl = `${config.serverUrl.replace(/\/$/, "")}/api/v1`
  }

  getProviderType(): "fiat" | "crypto" {
    return "crypto"
  }

  getProviderName(): string {
    return "BTCPay Server"
  }

  getSupportedCurrencies(): string[] {
    return ["BTC", "SATS", "USD", "EUR"] // BTC native, with fiat reference
  }

  // Customer Management - BTCPay doesn't have traditional customers, so we simulate
  async createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    // BTCPay doesn't have customer concept, generate a unique identifier
    const customerId = `btcpay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store customer data in metadata for invoices
    const customerData = {
      id: customerId,
      email,
      ...metadata,
      created: new Date().toISOString(),
    }

    // In a real implementation, you might store this in your own database
    // For now, we'll return the generated ID
    return customerId
  }

  async getCustomer(customerId: string): Promise<Customer> {
    // Since BTCPay doesn't store customers, we reconstruct from ID
    const [, timestamp] = customerId.split("_")

    return {
      id: customerId,
      email: "", // Would need to be stored separately
      created: new Date(parseInt(timestamp)),
    }
  }

  async updateCustomer(
    customerId: string,
    data: Partial<Customer>,
  ): Promise<Customer> {
    // BTCPay doesn't support customer updates, return updated data
    return {
      id: customerId,
      email: data.email || "",
      name: data.name,
      metadata: data.metadata,
      created: new Date(),
    }
  }

  // Subscription Management - Simulated with recurring invoices
  async createSubscription(
    customerId: string,
    config: SubscriptionConfig,
  ): Promise<Subscription> {
    if (!config.amount || !config.currency || !config.interval) {
      throw new Error(
        "BTCPay subscriptions require amount, currency, and interval",
      )
    }

    // Create a subscription record (you'd store this in your database)
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const subscription: Subscription = {
      id: subscriptionId,
      customerId,
      status: "active",
      amount: config.amount,
      currency: config.currency,
      interval: config.interval,
      currentPeriodStart: new Date(),
      currentPeriodEnd: this.calculateNextPeriod(new Date(), config.interval),
      cancelAtPeriodEnd: false,
      metadata: config.metadata,
    }

    // In a real implementation, store this subscription and set up recurring invoice creation
    return subscription
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    // Would retrieve from your database
    throw new Error(
      "Subscription retrieval not implemented - store in your database",
    )
  }

  async updateSubscription(
    subscriptionId: string,
    data: SubscriptionUpdate,
  ): Promise<Subscription> {
    // Would update in your database
    throw new Error(
      "Subscription update not implemented - store in your database",
    )
  }

  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    // Would update in your database
    throw new Error(
      "Subscription cancellation not implemented - store in your database",
    )
  }

  // One-time Payments
  async createPayment(config: PaymentConfig): Promise<Payment> {
    const invoice = await this.createInvoice({
      amount: config.amount,
      currency: config.currency,
      description: config.description,
      expiresInMinutes: config.expiresInMinutes || 60,
      metadata: {
        ...config.metadata,
        customerId: config.customerId,
        paymentType: "one-time",
      },
    })

    return this.mapInvoiceToPayment(invoice)
  }

  async getPayment(paymentId: string): Promise<Payment> {
    const invoice = await this.getInvoice(paymentId)
    return this.mapInvoiceToPayment(invoice)
  }

  // Checkout Sessions
  async createCheckoutSession(
    config: CheckoutConfig,
  ): Promise<CheckoutSession> {
    if (!config.amount || !config.currency) {
      throw new Error(
        "BTCPay requires amount and currency for checkout sessions",
      )
    }

    const invoice = await this.createInvoice({
      amount: config.amount,
      currency: config.currency,
      description:
        config.mode === "subscription"
          ? "Subscription Payment"
          : "One-time Payment",
      expiresInMinutes: config.expiresInMinutes || 60,
      redirectUrl: config.successUrl,
      metadata: {
        ...config.metadata,
        customerId: config.customerId,
        mode: config.mode,
        cancelUrl: config.cancelUrl,
      },
    })

    return {
      id: invoice.id,
      url: invoice.checkoutLink,
      customerId: config.customerId,
    }
  }

  // BTCPay doesn't have a billing portal equivalent
  async createBillingPortalSession?(
    customerId: string,
    returnUrl: string,
  ): Promise<BillingPortalSession> {
    throw new Error("BTCPay Server does not support billing portal sessions")
  }

  // Webhook signature verification
  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<WebhookEvent> {
    // BTCPay uses HMAC-SHA256 for webhook verification
    const crypto = require("crypto")
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex")

    if (signature !== expectedSignature) {
      throw new Error("Invalid webhook signature")
    }

    const webhookEvent: BTCPayWebhookEvent = JSON.parse(payload)

    return {
      id: webhookEvent.deliveryId,
      type: webhookEvent.type,
      data: {
        object: webhookEvent.data,
      },
      created: new Date(webhookEvent.timestamp),
    }
  }

  // Products and Pricing - BTCPay doesn't have built-in product catalog
  async listProducts(): Promise<Product[]> {
    // Return static product list or integrate with your own catalog
    return [
      {
        id: "keyfate_pro",
        name: "KeyFate Pro",
        description:
          "10 secrets, 5 recipients, flexible intervals, templates, email support",
        metadata: {
          provider: "btcpay",
        },
      },
    ]
  }

  async listPrices(productId?: string): Promise<Price[]> {
    // Return static pricing or integrate with your own pricing system
    return [
      {
        id: "pro_btc_monthly",
        productId: "keyfate_pro",
        currency: "BTC",
        unitAmount: 0.0002, // ~$9 at $45k BTC
        interval: "month",
        lookupKey: "pro_btc_monthly",
        metadata: {
          provider: "btcpay",
          fiatEquivalent: "USD:9.00",
        },
      },
      {
        id: "pro_btc_yearly",
        productId: "keyfate_pro",
        currency: "BTC",
        unitAmount: 0.002, // ~$90 at $45k BTC
        interval: "year",
        lookupKey: "pro_btc_yearly",
        metadata: {
          provider: "btcpay",
          fiatEquivalent: "USD:90.00",
        },
      },
    ]
  }

  // Currency conversion from fiat to BTC
  async convertToProviderCurrency(
    amount: number,
    fromCurrency: string,
  ): Promise<number> {
    if (fromCurrency === "BTC") return amount

    // Get current BTC rate from BTCPay or external API
    const response = await fetch(
      `${this.baseUrl}/stores/${this.config.storeId}/rates`,
      {
        headers: {
          Authorization: `token ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rates")
    }

    const rates = await response.json()
    const btcRate = rates.find((r: any) => r.code === fromCurrency)?.rate

    if (!btcRate) {
      throw new Error(`Exchange rate not found for ${fromCurrency}`)
    }

    return amount / btcRate
  }

  // Private helper methods
  private async createInvoice(params: {
    amount: number
    currency: string
    description?: string
    expiresInMinutes?: number
    redirectUrl?: string
    metadata?: Record<string, any>
  }): Promise<BTCPayInvoice> {
    const response = await fetch(
      `${this.baseUrl}/stores/${this.config.storeId}/invoices`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amount.toString(),
          currency: params.currency,
          metadata: params.metadata || {},
          checkout: {
            expirationMinutes: params.expiresInMinutes || 60,
            redirectURL: params.redirectUrl,
          },
        }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create BTCPay invoice: ${error}`)
    }

    return await response.json()
  }

  private async getInvoice(invoiceId: string): Promise<BTCPayInvoice> {
    const response = await fetch(
      `${this.baseUrl}/stores/${this.config.storeId}/invoices/${invoiceId}`,
      {
        headers: {
          Authorization: `token ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error("Failed to fetch BTCPay invoice")
    }

    return await response.json()
  }

  private mapInvoiceToPayment(invoice: BTCPayInvoice): Payment {
    return {
      id: invoice.id,
      customerId: invoice.metadata?.customerId,
      amount: parseFloat(invoice.amount),
      currency: invoice.currency,
      status: this.mapInvoiceStatus(invoice.status),
      description: invoice.metadata?.description,
      metadata: invoice.metadata,
      createdAt: new Date(invoice.createdTime),
      completedAt: invoice.status === "Settled" ? new Date() : undefined,
      expiresAt: new Date(invoice.expirationTime),
    }
  }

  private mapInvoiceStatus(status: string): Payment["status"] {
    switch (status) {
      case "Settled":
        return "completed"
      case "Processing":
        return "processing"
      case "Expired":
        return "expired"
      case "Invalid":
        return "failed"
      case "New":
      default:
        return "pending"
    }
  }

  private calculateNextPeriod(
    start: Date,
    interval: "month" | "year" | "day",
  ): Date {
    const next = new Date(start)
    switch (interval) {
      case "day":
        next.setDate(next.getDate() + 1)
        break
      case "month":
        next.setMonth(next.getMonth() + 1)
        break
      case "year":
        next.setFullYear(next.getFullYear() + 1)
        break
    }
    return next
  }
}
```

## API Routes for BTCPay Integration

### Checkout Session Creation

```typescript
// app/api/create-btcpay-checkout/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cryptoPaymentProvider } from "@/lib/payment"
import { createClient } from "@/utils/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { amount, currency = "BTC", mode = "payment" } = await request.json()

    // Get user from Supabase auth
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Convert fiat to BTC if needed
    let btcAmount = amount
    if (currency !== "BTC") {
      btcAmount = await cryptoPaymentProvider.convertToProviderCurrency!(
        amount,
        currency,
      )
    }

    // Create or get customer
    const customerId = await cryptoPaymentProvider.createCustomer(user.email!, {
      user_id: user.id,
    })

    // Create checkout session
    const session = await cryptoPaymentProvider.createCheckoutSession({
      customerId,
      amount: btcAmount,
      currency: "BTC",
      mode,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}&provider=btcpay`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true&provider=btcpay`,
      expiresInMinutes: 60,
      metadata: {
        user_id: user.id,
        original_amount: amount.toString(),
        original_currency: currency,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Error creating BTCPay checkout session:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
```

### BTCPay Webhook Handler

```typescript
// app/api/webhooks/btcpay/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cryptoPaymentProvider } from "@/lib/payment"
import { createClient } from "@/utils/supabase/server"
import { serverEnv } from "@/lib/server-env"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("btcpay-sig")

    if (!signature) {
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 },
      )
    }

    // Verify webhook signature
    const event = await cryptoPaymentProvider.verifyWebhookSignature(
      body,
      signature,
      serverEnv.BTCPAY_WEBHOOK_SECRET,
    )

    const supabase = createClient()

    // Handle different event types
    switch (event.type) {
      case "InvoiceSettled":
        await handleInvoiceSettled(event, supabase)
        break

      case "InvoiceExpired":
        await handleInvoiceExpired(event, supabase)
        break

      case "InvoiceInvalid":
        await handleInvoiceInvalid(event, supabase)
        break

      case "InvoiceProcessing":
        await handleInvoiceProcessing(event, supabase)
        break

      default:
        console.log(`Unhandled BTCPay event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("BTCPay webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 },
    )
  }
}

async function handleInvoiceSettled(event: any, supabase: any) {
  const invoice = event.data.object
  const userId = invoice.metadata?.user_id

  if (!userId) {
    console.error("No user_id in invoice metadata")
    return
  }

  // Update user to Pro tier if this was a subscription payment
  if (invoice.metadata?.mode === "subscription") {
    await supabase.from("user_subscriptions").upsert({
      user_id: userId,
      btcpay_invoice_id: invoice.id,
      status: "active",
      payment_method: "bitcoin",
      tier_id: "pro",
      current_period_start: new Date(),
      current_period_end: calculateNextBillingDate(
        invoice.metadata?.interval || "month",
      ),
    })
  }

  console.log(`Bitcoin payment settled for user ${userId}`)
}

async function handleInvoiceExpired(event: any, supabase: any) {
  const invoice = event.data.object
  console.log(`Invoice expired: ${invoice.id}`)
}

async function handleInvoiceInvalid(event: any, supabase: any) {
  const invoice = event.data.object
  console.log(`Invoice invalid: ${invoice.id}`)
}

async function handleInvoiceProcessing(event: any, supabase: any) {
  const invoice = event.data.object
  console.log(`Invoice processing: ${invoice.id}`)
}

function calculateNextBillingDate(interval: string): Date {
  const now = new Date()
  switch (interval) {
    case "month":
      return new Date(now.setMonth(now.getMonth() + 1))
    case "year":
      return new Date(now.setFullYear(now.getFullYear() + 1))
    default:
      return new Date(now.setMonth(now.getMonth() + 1))
  }
}
```

## Frontend Components

### BTCPay Checkout Button

```tsx
// components/subscription/BTCPayCheckoutButton.tsx
"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Bitcoin } from "lucide-react"

interface BTCPayCheckoutButtonProps {
  amount: number
  currency?: string
  mode?: "payment" | "subscription"
  children: React.ReactNode
  disabled?: boolean
}

export function BTCPayCheckoutButton({
  amount,
  currency = "USD",
  mode = "payment",
  children,
  disabled,
}: BTCPayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/create-btcpay-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency,
          mode,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        console.error("BTCPay checkout failed")
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleCheckout}
      disabled={disabled || loading}
      className="w-full bg-orange-500 text-white hover:bg-orange-600"
      variant="default"
    >
      <Bitcoin className="mr-2 h-4 w-4" />
      {loading ? "Loading..." : children}
    </Button>
  )
}
```

### Payment Method Selector

```tsx
// components/subscription/PaymentMethodSelector.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CreditCard, Bitcoin } from "lucide-react"
import { StripeCheckoutButton } from "./StripeCheckoutButton"
import { BTCPayCheckoutButton } from "./BTCPayCheckoutButton"

interface PaymentMethodSelectorProps {
  amount: number
  interval: "month" | "year"
  lookupKey: string
}

export function PaymentMethodSelector({
  amount,
  interval,
  lookupKey,
}: PaymentMethodSelectorProps) {
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "btcpay">(
    "stripe",
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Payment Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={paymentMethod}
          onValueChange={(value) =>
            setPaymentMethod(value as "stripe" | "btcpay")
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="stripe" id="stripe" />
            <Label htmlFor="stripe" className="flex items-center">
              <CreditCard className="mr-2 h-4 w-4" />
              Credit Card (Stripe)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="btcpay" id="btcpay" />
            <Label htmlFor="btcpay" className="flex items-center">
              <Bitcoin className="mr-2 h-4 w-4" />
              Bitcoin (BTCPay Server)
            </Label>
          </div>
        </RadioGroup>

        <div className="pt-4">
          {paymentMethod === "stripe" ? (
            <StripeCheckoutButton lookupKey={lookupKey}>
              Subscribe with Card - ${amount}/{interval}
            </StripeCheckoutButton>
          ) : (
            <BTCPayCheckoutButton
              amount={amount}
              currency="USD"
              mode="subscription"
            >
              Subscribe with Bitcoin - ${amount}/{interval}
            </BTCPayCheckoutButton>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

## BTCPay Server Setup

### 1. Deploy BTCPay Server

Choose a deployment method from the [BTCPay Server documentation](https://docs.btcpayserver.org/Development/):

- **Web-Interface LunaNode**: Easiest, one-click deployment
- **Azure Deployment**: Microsoft Azure one-click deploy
- **Docker Deployment**: Using docker-compose.yml
- **Manual Deployment**: Full control, more complex

### 2. Create Store and API Key

1. Login to your BTCPay Server instance
2. Create a new store for KeyFate
3. Go to Settings → Access Tokens
4. Create API key with permissions:
   - `btcpay.store.canmodifyinvoices`
   - `btcpay.store.canviewinvoices`
   - `btcpay.store.webhooks.canmodifywebhooks`

### 3. Configure Webhooks

1. Go to Settings → Webhooks
2. Add webhook endpoint: `https://yourdomain.com/api/webhooks/btcpay`
3. Select events:
   - `Invoice settled`
   - `Invoice expired`
   - `Invoice invalid`
   - `Invoice processing`

### 4. Setup Lightning (Optional)

For instant payments, configure Lightning Network:

1. Go to Lightning → Settings
2. Connect to Core Lightning (CLN) or LND
3. Open channels for liquidity

## Database Updates

### Extended Schema for BTCPay

```sql
-- Add BTCPay columns to user_subscriptions
ALTER TABLE user_subscriptions
ADD COLUMN btcpay_invoice_id TEXT,
ADD COLUMN payment_method TEXT DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'bitcoin')),
ADD COLUMN btc_amount DECIMAL(16,8), -- Bitcoin amount in BTC
ADD COLUMN exchange_rate DECIMAL(16,2); -- USD/BTC rate at payment time

-- Create crypto_payments table for one-time Bitcoin payments
CREATE TABLE crypto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  btcpay_invoice_id TEXT UNIQUE NOT NULL,
  amount_btc DECIMAL(16,8) NOT NULL,
  amount_fiat DECIMAL(10,2) NOT NULL,
  fiat_currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate DECIMAL(16,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add indexes
CREATE INDEX idx_crypto_payments_user_id ON crypto_payments(user_id);
CREATE INDEX idx_crypto_payments_invoice_id ON crypto_payments(btcpay_invoice_id);
CREATE INDEX idx_crypto_payments_status ON crypto_payments(status);
CREATE INDEX idx_user_subscriptions_payment_method ON user_subscriptions(payment_method);
```

## Testing BTCPay Integration

### Environment-Based Pricing

The BTCPayProvider automatically adjusts pricing based on the `NEXT_PUBLIC_ENV` environment variable:

**Test Environments** (local, development, dev, staging, stage):

- Monthly: 10 sats (0.00000010 BTC ≈ $0.005)
- Yearly: 100 sats (0.00000100 BTC ≈ $0.05)

**Production Environments** (production, prod, or undefined):

- Monthly: 20,000 sats (0.0002 BTC ≈ $9)
- Yearly: 200,000 sats (0.002 BTC ≈ $90)

This allows developers to test the complete payment flow with minimal cost while maintaining production pricing in live environments.

### 1. Testnet Setup

1. Deploy BTCPay on testnet
2. Use testnet Bitcoin for testing
3. Configure testnet Lightning channels

### 2. Test Invoice Creation

```bash
# Test BTCPay API connectivity
curl -X POST \
  https://your-btcpay-server.com/api/v1/stores/STORE_ID/invoices \
  -H "Authorization: token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "0.001",
    "currency": "BTC",
    "metadata": {
      "test": "true"
    }
  }'
```

### 3. Webhook Testing

```bash
# Use ngrok for local webhook testing
ngrok http 3000

# Update BTCPay webhook URL to ngrok URL
# Test payment flow with testnet Bitcoin
```

## Security Considerations

1. **API Key Security**: Store BTCPay API keys securely, rotate regularly
2. **Webhook Verification**: Always verify webhook signatures
3. **Network Security**: Use HTTPS for all BTCPay communications
4. **Node Security**: Keep Bitcoin Core and BTCPay Server updated
5. **Lightning Security**: Monitor Lightning channels, backup seed phrases
6. **Rate Limiting**: Implement rate limiting on BTCPay API calls

## Advantages of BTCPay Integration

1. **Self-Hosted**: Complete control over payment processing
2. **No KYC**: Users can pay without identity verification
3. **Lightning Fast**: Instant payments via Lightning Network
4. **Low Fees**: Only Bitcoin network fees, no payment processor fees
5. **Censorship Resistant**: Cannot be blocked by traditional financial systems
6. **Privacy**: Better privacy compared to traditional payment methods

## Multi-Currency Support

The modular design allows KeyFate to accept both fiat (via Stripe) and Bitcoin (via BTCPay Server), giving users maximum payment flexibility while maintaining security and user experience standards.

This architecture ensures that whether users prefer traditional credit card payments or cryptocurrency, they can access KeyFate's services through their preferred payment method.
