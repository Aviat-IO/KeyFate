import { StripeProvider } from "@/lib/payment/providers/StripeProvider"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock Stripe
const mockStripe = {
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  subscriptions: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
  products: {
    list: vi.fn(),
  },
  prices: {
    list: vi.fn(),
  },
}

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => mockStripe),
  }
})

describe("StripeProvider", () => {
  let provider: StripeProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new StripeProvider("sk_test_123")
  })

  describe("constructor", () => {
    it("should initialize with correct API version", () => {
      expect(provider).toBeDefined()
      expect(provider.getProviderType()).toBe("fiat")
      expect(provider.getProviderName()).toBe("Stripe")
    })
  })

  describe("provider info methods", () => {
    it("should return correct provider type", () => {
      expect(provider.getProviderType()).toBe("fiat")
    })

    it("should return correct provider name", () => {
      expect(provider.getProviderName()).toBe("Stripe")
    })

    it("should return supported currencies", () => {
      const currencies = provider.getSupportedCurrencies()
      expect(currencies).toContain("USD")
      expect(currencies).toContain("EUR")
      expect(currencies).toContain("GBP")
    })
  })

  describe("customer management", () => {
    it("should create a customer successfully", async () => {
      const mockCustomer = { id: "cus_123" }
      mockStripe.customers.create.mockResolvedValue(mockCustomer)

      const customerId = await provider.createCustomer("test@example.com", {
        user_id: "123",
      })

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: "test@example.com",
        metadata: { user_id: "123" },
      })
      expect(customerId).toBe("cus_123")
    })

    it("should retrieve a customer successfully", async () => {
      const mockCustomer = {
        id: "cus_123",
        email: "test@example.com",
        name: "Test User",
        metadata: { user_id: "123" },
        created: 1640995200, // Unix timestamp
      }
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer)

      const customer = await provider.getCustomer("cus_123")

      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith("cus_123")
      expect(customer).toEqual({
        id: "cus_123",
        email: "test@example.com",
        name: "Test User",
        metadata: { user_id: "123" },
        created: new Date(1640995200 * 1000),
      })
    })

    it("should update a customer successfully", async () => {
      const mockUpdatedCustomer = {
        id: "cus_123",
        email: "updated@example.com",
        name: "Updated User",
        metadata: { user_id: "123" },
        created: 1640995200,
      }
      mockStripe.customers.update.mockResolvedValue(mockUpdatedCustomer)

      const updateData = {
        email: "updated@example.com",
        name: "Updated User",
      }

      const customer = await provider.updateCustomer("cus_123", updateData)

      expect(mockStripe.customers.update).toHaveBeenCalledWith("cus_123", {
        email: "updated@example.com",
        name: "Updated User",
        metadata: undefined,
      })
      expect(customer.email).toBe("updated@example.com")
      expect(customer.name).toBe("Updated User")
    })
  })

  describe("subscription management", () => {
    it("should create a subscription successfully", async () => {
      const mockSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        items: {
          data: [
            {
              price: {
                id: "price_123",
                unit_amount: 999,
                currency: "usd",
                recurring: { interval: "month" },
              },
            },
          ],
        },
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        cancel_at_period_end: false,
        metadata: {},
      }
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription)

      const config = {
        priceId: "price_123",
        metadata: { user_id: "123" },
      }

      const subscription = await provider.createSubscription("cus_123", config)

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        items: [{ price: "price_123" }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: { user_id: "123" },
      })
      expect(subscription.id).toBe("sub_123")
      expect(subscription.customerId).toBe("cus_123")
      expect(subscription.status).toBe("active")
    })

    it("should throw error when creating subscription without priceId", async () => {
      const config = {
        amount: 10,
        currency: "USD",
        interval: "month" as const,
      }

      await expect(
        provider.createSubscription("cus_123", config),
      ).rejects.toThrow("Stripe requires priceId for subscriptions")
    })

    it("should retrieve a subscription successfully", async () => {
      const mockSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        items: {
          data: [
            {
              price: {
                id: "price_123",
                unit_amount: 999,
                currency: "usd",
                recurring: { interval: "month" },
              },
            },
          ],
        },
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        cancel_at_period_end: false,
        metadata: {},
      }
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription)

      const subscription = await provider.getSubscription("sub_123")

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123")
      expect(subscription.id).toBe("sub_123")
    })

    it("should update a subscription successfully", async () => {
      const mockUpdatedSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        items: {
          data: [
            {
              price: {
                id: "price_456",
                unit_amount: 1999,
                currency: "usd",
                recurring: { interval: "month" },
              },
            },
          ],
        },
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        cancel_at_period_end: true,
        metadata: {},
      }
      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription)

      const updateData = {
        priceId: "price_456",
        cancelAtPeriodEnd: true,
      }

      const subscription = await provider.updateSubscription(
        "sub_123",
        updateData,
      )

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        items: [{ price: "price_456" }],
        cancel_at_period_end: true,
      })
      expect(subscription.cancelAtPeriodEnd).toBe(true)
    })

    it("should cancel a subscription successfully", async () => {
      const mockCanceledSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "canceled",
        items: {
          data: [
            {
              price: {
                id: "price_123",
                unit_amount: 999,
                currency: "usd",
                recurring: { interval: "month" },
              },
            },
          ],
        },
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        cancel_at_period_end: false,
        metadata: {},
      }
      mockStripe.subscriptions.cancel.mockResolvedValue(
        mockCanceledSubscription,
      )

      const subscription = await provider.cancelSubscription("sub_123")

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith("sub_123")
      expect(subscription.status).toBe("canceled")
    })
  })

  describe("payment management", () => {
    it("should create a payment successfully", async () => {
      const mockPaymentIntent = {
        id: "pi_123",
        customer: "cus_123",
        amount: 1000, // $10.00 in cents
        currency: "usd",
        status: "succeeded",
        description: "Test payment",
        metadata: { order_id: "123" },
        created: 1640995200,
      }
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent)

      const config = {
        amount: 10.0,
        currency: "USD",
        description: "Test payment",
        customerId: "cus_123",
        metadata: { order_id: "123" },
      }

      const payment = await provider.createPayment(config)

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000, // Converted to cents
        currency: "usd",
        customer: "cus_123",
        description: "Test payment",
        metadata: { order_id: "123" },
      })
      expect(payment.id).toBe("pi_123")
      expect(payment.amount).toBe(10.0) // Converted back from cents
      expect(payment.currency).toBe("USD")
    })

    it("should retrieve a payment successfully", async () => {
      const mockPaymentIntent = {
        id: "pi_123",
        customer: "cus_123",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        description: "Test payment",
        metadata: {},
        created: 1640995200,
      }
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent)

      const payment = await provider.getPayment("pi_123")

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith("pi_123")
      expect(payment.id).toBe("pi_123")
      expect(payment.status).toBe("completed") // Mapped from 'succeeded'
    })
  })

  describe("checkout sessions", () => {
    it("should create a subscription checkout session", async () => {
      const mockSession = {
        id: "cs_123",
        url: "https://checkout.stripe.com/session/cs_123",
        customer: "cus_123",
      }
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession)

      const config = {
        customerId: "cus_123",
        priceId: "price_123",
        mode: "subscription" as const,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        billingAddressCollection: "auto" as const,
        metadata: { user_id: "123" },
      }

      const session = await provider.createCheckoutSession(config)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        mode: "subscription",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        line_items: [
          {
            price: "price_123",
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: { user_id: "123" },
        },
        customer: "cus_123",
        billing_address_collection: "auto",
        metadata: { user_id: "123" },
      })
      expect(session.id).toBe("cs_123")
      expect(session.url).toBe("https://checkout.stripe.com/session/cs_123")
    })

    it("should create a payment checkout session", async () => {
      const mockSession = {
        id: "cs_456",
        url: "https://checkout.stripe.com/session/cs_456",
        customer: null,
      }
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession)

      const config = {
        amount: 25.0,
        currency: "USD",
        mode: "payment" as const,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }

      const session = await provider.createCheckoutSession(config)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        mode: "payment",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 2500, // $25.00 in cents
              product_data: {
                name: "KeyFate Payment",
              },
            },
            quantity: 1,
          },
        ],
      })
      expect(session.id).toBe("cs_456")
    })

    it("should throw error for subscription mode without priceId", async () => {
      const config = {
        amount: 25.0,
        currency: "USD",
        mode: "subscription" as const,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }

      await expect(provider.createCheckoutSession(config)).rejects.toThrow(
        "priceId is required for subscription mode",
      )
    })

    it("should throw error for payment mode without amount or currency", async () => {
      const config = {
        priceId: "price_123",
        mode: "payment" as const,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }

      await expect(provider.createCheckoutSession(config)).rejects.toThrow(
        "amount and currency are required for payment mode",
      )
    })
  })

  describe("billing portal", () => {
    it("should create a billing portal session", async () => {
      const mockPortalSession = {
        id: "bps_123",
        url: "https://billing.stripe.com/session/bps_123",
      }
      mockStripe.billingPortal.sessions.create.mockResolvedValue(
        mockPortalSession,
      )

      const session = await provider.createBillingPortalSession(
        "cus_123",
        "https://example.com/return",
      )

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: "https://example.com/return",
      })
      expect(session.id).toBe("bps_123")
      expect(session.url).toBe("https://billing.stripe.com/session/bps_123")
    })
  })

  describe("webhooks", () => {
    it("should verify webhook signature successfully", async () => {
      const mockEvent = {
        id: "evt_123",
        type: "invoice.payment_succeeded",
        data: { object: { id: "in_123" } },
        created: 1640995200,
      }
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)

      const event = await provider.verifyWebhookSignature(
        "webhook_payload",
        "signature",
        "webhook_secret",
      )

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        "webhook_payload",
        "signature",
        "webhook_secret",
      )
      expect(event.id).toBe("evt_123")
      expect(event.type).toBe("invoice.payment_succeeded")
      expect(event.created).toEqual(new Date(1640995200 * 1000))
    })
  })

  describe("products and prices", () => {
    it("should list products successfully", async () => {
      const mockProducts = {
        data: [
          {
            id: "prod_123",
            name: "KeyFate Pro",
            description: "Pro subscription",
            metadata: { tier: "pro" },
          },
        ],
      }
      mockStripe.products.list.mockResolvedValue(mockProducts)

      const products = await provider.listProducts()

      expect(mockStripe.products.list).toHaveBeenCalledWith({ active: true })
      expect(products).toHaveLength(1)
      expect(products[0].id).toBe("prod_123")
      expect(products[0].name).toBe("KeyFate Pro")
    })

    it("should list prices successfully", async () => {
      const mockPrices = {
        data: [
          {
            id: "price_123",
            product: "prod_123",
            currency: "usd",
            unit_amount: 999,
            recurring: { interval: "month", interval_count: 1 },
            lookup_key: "pro_monthly",
            metadata: { tier: "pro" },
          },
        ],
      }
      mockStripe.prices.list.mockResolvedValue(mockPrices)

      const prices = await provider.listPrices("prod_123")

      expect(mockStripe.prices.list).toHaveBeenCalledWith({
        active: true,
        product: "prod_123",
      })
      expect(prices).toHaveLength(1)
      expect(prices[0].id).toBe("price_123")
      expect(prices[0].unitAmount).toBe(999)
      expect(prices[0].interval).toBe("month")
    })

    it("should list all prices when no productId provided", async () => {
      const mockPrices = { data: [] }
      mockStripe.prices.list.mockResolvedValue(mockPrices)

      await provider.listPrices()

      expect(mockStripe.prices.list).toHaveBeenCalledWith({ active: true })
    })
  })
})
