import { createHmac } from "crypto"
import { timingSafeStringEqual } from "@/lib/crypto/timing-safe"
import {
  BillingPortalSession,
  CheckoutConfig,
  CheckoutSession,
  Customer,
  Payment,
  PaymentConfig,
  PaymentProvider,
  Price,
  Product,
  Subscription,
  SubscriptionConfig,
  SubscriptionUpdate,
  WebhookEvent,
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
  additionalStatus?: string
  createdTime: string
  expirationTime: string
  monitoringExpiration?: string
  metadata?: Record<string, unknown>
}

export interface BTCPayWebhookEventRaw {
  deliveryId: string
  webhookId: string
  originalDeliveryId?: string
  isRedelivery: boolean
  type: string
  timestamp: string
  storeId: string
  invoiceId: string
  data: Record<string, unknown>
}

export class BTCPayProvider implements PaymentProvider {
  private config: BTCPayConfig
  private baseUrl: string

  private static readonly PROD_MONTHLY_BTC = 0.0002
  private static readonly PROD_YEARLY_BTC = 0.002
  private static readonly TEST_MONTHLY_BTC = 0.0000001
  private static readonly TEST_YEARLY_BTC = 0.000001

  constructor(config: BTCPayConfig) {
    this.config = config
    this.baseUrl = `${config.serverUrl.replace(/\/$/, "")}/api/v1`
  }

  private isTestEnvironment(): boolean {
    const env = process.env.NEXT_PUBLIC_ENV?.toLowerCase() || ""
    return ["local", "development", "dev", "staging", "stage"].includes(env)
  }

  getProviderType(): "fiat" | "crypto" {
    return "crypto"
  }

  getProviderName(): string {
    return "BTCPay Server"
  }

  getSupportedCurrencies(): string[] {
    return ["BTC", "SATS"] // Use BTC-native amounts
  }

  // Customer Management - BTCPay has no native customers; simulate via metadata
  async createCustomer(
    _email: string,
    _metadata?: Record<string, string>,
  ): Promise<string> {
    // BTCPay doesn't have native customers; we simulate via metadata
    void _email // Explicitly ignore unused parameter
    void _metadata // Explicitly ignore unused parameter
    const customerId = `btcpay_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`
    // Persist externally if needed by the app; here we just return the ID
    return customerId
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const [, timestamp] = customerId.split("_")
    return {
      id: customerId,
      email: "",
      created: new Date(Number(timestamp) || Date.now()),
    }
  }

  async updateCustomer(
    customerId: string,
    data: Partial<Customer>,
  ): Promise<Customer> {
    return {
      id: customerId,
      email: data.email || "",
      name: data.name,
      metadata: data.metadata,
      created: new Date(),
    }
  }

  // Subscription Management - emulate via recurring invoices (outside scope here)
  async createSubscription(
    customerId: string,
    config: SubscriptionConfig,
  ): Promise<Subscription> {
    if (!config.amount || !config.currency || !config.interval) {
      throw new Error(
        "BTCPay subscriptions require amount, currency, and interval",
      )
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`
    const now = new Date()
    return {
      id: subscriptionId,
      customerId,
      status: "active",
      amount: config.amount,
      currency: config.currency,
      interval: config.interval,
      currentPeriodStart: now,
      currentPeriodEnd: this.calculateNextPeriod(now, config.interval),
      cancelAtPeriodEnd: false,
      metadata: config.metadata,
    }
  }

  async getSubscription(_subscriptionId: string): Promise<Subscription> {
    void _subscriptionId // Explicitly ignore unused parameter
    throw new Error("Subscription retrieval not implemented for BTCPay")
  }

  async updateSubscription(
    _subscriptionId: string,
    _data: SubscriptionUpdate,
  ): Promise<Subscription> {
    void _subscriptionId // Explicitly ignore unused parameter
    void _data // Explicitly ignore unused parameter
    throw new Error("Subscription update not implemented for BTCPay")
  }

  async cancelSubscription(_subscriptionId: string): Promise<Subscription> {
    void _subscriptionId // Explicitly ignore unused parameter
    throw new Error("Subscription cancellation not implemented for BTCPay")
  }

  // One-time Payments via invoice
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

  async createBillingPortalSession(
    _customerId: string,
    _returnUrl: string,
  ): Promise<BillingPortalSession> {
    void _customerId // Explicitly ignore unused parameter
    void _returnUrl // Explicitly ignore unused parameter
    throw new Error("BTCPay Server does not support billing portal sessions")
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<WebhookEvent> {
    // BTCPay Server sends signature in format: sha256=HMAC_HASH
    // We need to extract just the hash part for comparison
    let actualSignature = signature
    if (signature.startsWith("sha256=")) {
      actualSignature = signature.substring(7)
    }

    const expected = createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex")

    console.log("🔐 Webhook signature verification:", {
      signatureFormat: signature.startsWith("sha256=") ? "sha256=" : "raw",
      actualSignatureLength: actualSignature.length,
      expectedSignatureLength: expected.length,
      secretLength: secret.length,
      payloadLength: payload.length,
      signaturesMatch: actualSignature === expected,
    })

    if (!timingSafeStringEqual(actualSignature, expected)) {
      console.error("❌ Signature mismatch:", {
        received: actualSignature.substring(0, 20) + "...",
        expected: expected.substring(0, 20) + "...",
      })
      throw new Error("Invalid webhook signature")
    }

    const raw: BTCPayWebhookEventRaw = JSON.parse(payload)

    console.log("📦 Raw BTCPay webhook data:", {
      deliveryId: raw.deliveryId,
      type: raw.type,
      hasData: !!raw.data,
      dataKeys: raw.data ? Object.keys(raw.data) : [],
      dataType: typeof raw.data,
      rawDataSample: raw.data
        ? JSON.stringify(raw.data).substring(0, 200)
        : "null",
    })

    return {
      id: raw.deliveryId,
      type: raw.type,
      data: { object: raw.data },
      created: new Date(raw.timestamp),
    }
  }

  async listProducts(): Promise<Product[]> {
    return [
      {
        id: "keyfate_pro",
        name: "KeyFate Pro",
        description: "Includes Pro features",
        metadata: { provider: "btcpay" },
      },
    ]
  }

  async listPrices(_productId?: string): Promise<Price[]> {
    void _productId
    const isTest = this.isTestEnvironment()
    const monthlyAmount = isTest
      ? BTCPayProvider.TEST_MONTHLY_BTC
      : BTCPayProvider.PROD_MONTHLY_BTC
    const yearlyAmount = isTest
      ? BTCPayProvider.TEST_YEARLY_BTC
      : BTCPayProvider.PROD_YEARLY_BTC

    return [
      {
        id: "pro_btc_monthly",
        productId: "keyfate_pro",
        currency: "BTC",
        unitAmount: monthlyAmount,
        interval: "month",
        lookupKey: "pro_btc_monthly",
        metadata: { provider: "btcpay" },
      },
      {
        id: "pro_btc_yearly",
        productId: "keyfate_pro",
        currency: "BTC",
        unitAmount: yearlyAmount,
        interval: "year",
        lookupKey: "pro_btc_yearly",
        metadata: { provider: "btcpay" },
      },
    ]
  }

  async convertToProviderCurrency(
    amount: number,
    fromCurrency: string,
  ): Promise<number> {
    if (fromCurrency === "BTC") return amount

    try {
      // Try BTCPay Server rates first
      const btcRate = await this.getBTCPayRate(fromCurrency)
      if (btcRate) {
        return amount / btcRate
      }
    } catch {
      // BTCPay rates unavailable, will try fallback
    }

    // Fallback to external rate API
    try {
      const fallbackRate = await this.getFallbackRate(fromCurrency)
      return amount / fallbackRate
    } catch (error) {
      throw new Error(
        `Failed to get exchange rate for ${fromCurrency}: ${error}`,
      )
    }
  }

  private async getBTCPayRate(currency: string): Promise<number | null> {
    // Try multiple rate endpoints as different BTCPay versions use different paths
    const endpoints = [
      `${this.baseUrl}/stores/${this.config.storeId}/rates`,
      `${this.baseUrl}/rates`,
      `${this.baseUrl}/api/rates`,
      `${this.baseUrl}/stores/${this.config.storeId}/rates/${currency}`,
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `token ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          continue
        }

        const data = await response.json()

        // Handle different response formats
        let rates: Array<{ code: string; rate: number }> = []

        if (Array.isArray(data)) {
          rates = data
        } else if (data.rates && Array.isArray(data.rates)) {
          rates = data.rates
        } else if (data[currency]) {
          // Single currency response
          return data[currency]
        }

        if (rates && rates.length > 0) {
          const btcRate = rates.find((r) => r.code === currency)?.rate
          if (btcRate) {
            return btcRate
          }
        }
      } catch {
        continue
      }
    }

    // BTCPay rates unavailable, will fall back to external API
    return null
  }

  private async getFallbackRate(currency: string): Promise<number> {
    // Use CoinGecko API as fallback
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency.toLowerCase()}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data = await response.json()
    const rate = data.bitcoin?.[currency.toLowerCase()]

    if (!rate) {
      throw new Error(`Rate not found for ${currency}`)
    }

    return rate
  }

  // Private helpers
  private async createInvoice(params: {
    amount: number
    currency: string
    description?: string
    expiresInMinutes?: number
    redirectUrl?: string
    metadata?: Record<string, unknown>
  }): Promise<BTCPayInvoice> {
    try {
      const requestBody = {
        amount: params.amount.toString(),
        currency: params.currency,
        metadata: params.metadata || {},
        checkout: {
          expirationMinutes: params.expiresInMinutes || 60,
          redirectURL: params.redirectUrl,
        },
      }

      const response = await fetch(
        `${this.baseUrl}/stores/${this.config.storeId}/invoices`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `BTCPay invoice creation failed (${response.status})`

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorMessage
        } catch {
          errorMessage = `${errorMessage}: ${errorText}`
        }

        console.error("BTCPay invoice creation error:", {
          status: response.status,
          error: errorText,
        })

        throw new Error(errorMessage)
      }

      const invoice = await response.json()
      return invoice as BTCPayInvoice
    } catch (error) {
      console.error("BTCPay invoice creation failed:", error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Unknown error creating BTCPay invoice: ${error}`)
    }
  }

  async getInvoice(invoiceId: string): Promise<BTCPayInvoice> {
    try {
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
        const errorText = await response.text()

        if (response.status === 404) {
          throw new Error(`BTCPay invoice not found: ${invoiceId}`)
        }

        console.error("BTCPay invoice fetch error:", {
          status: response.status,
          invoiceId,
          error: errorText,
        })

        throw new Error(
          `Failed to fetch BTCPay invoice (${response.status}): ${errorText}`,
        )
      }

      const invoice = await response.json()
      return invoice as BTCPayInvoice
    } catch (error) {
      console.error("BTCPay invoice fetch failed:", error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Unknown error fetching BTCPay invoice: ${error}`)
    }
  }

  private mapInvoiceToPayment(invoice: BTCPayInvoice): Payment {
    return {
      id: invoice.id,
      customerId: invoice.metadata?.customerId as string | undefined,
      amount: parseFloat(invoice.amount),
      currency: invoice.currency,
      status: this.mapInvoiceStatus(invoice.status),
      description:
        (invoice.metadata?.description as string | undefined) || undefined,
      metadata:
        (invoice.metadata as Record<string, string> | undefined) || undefined,
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
    if (interval === "day") {
      next.setDate(next.getDate() + 1)
    } else if (interval === "month") {
      next.setMonth(next.getMonth() + 1)
    } else if (interval === "year") {
      next.setFullYear(next.getFullYear() + 1)
    }
    return next
  }
}
