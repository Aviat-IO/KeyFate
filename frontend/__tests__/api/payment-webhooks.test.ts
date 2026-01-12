import { NextRequest } from "next/server"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Create a configurable mock for database lookups - exported so tests can modify
const mockDbState = {
  lookupResult: [] as { userId: string }[],
}

// Mock modules
vi.mock("@/lib/db/drizzle", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([]),
      }),
    }),
  },
  getDatabase: vi.fn(),
}))

vi.mock("@/lib/server-env", () => ({
  serverEnv: {
    STRIPE_WEBHOOK_SECRET: "test-stripe-secret",
    BTCPAY_WEBHOOK_SECRET: "test-btcpay-secret",
  },
}))

// Mock payment providers
const mockStripeProvider = {
  verifyWebhookSignature: vi.fn(),
}

const mockBTCPayProvider = {
  verifyWebhookSignature: vi.fn(),
}

vi.mock("@/lib/payment", () => ({
  getFiatPaymentProvider: () => mockStripeProvider,
  getCryptoPaymentProvider: () => mockBTCPayProvider,
}))

// Mock subscription service
const mockSubscriptionService = {
  handleStripeWebhook: vi.fn(),
  handleBTCPayWebhook: vi.fn(),
}

vi.mock("@/lib/services/subscription-service", () => ({
  subscriptionService: mockSubscriptionService,
}))

// Mock email service
const mockEmailService = {
  sendAdminAlert: vi.fn(),
}

vi.mock("@/lib/services/email-service", () => ({
  emailService: mockEmailService,
}))

// Mock webhook deduplication
vi.mock("@/lib/webhooks/deduplication", () => ({
  isWebhookProcessed: vi.fn().mockResolvedValue(false),
  recordWebhookEvent: vi.fn().mockResolvedValue(undefined),
}))

describe("Payment Webhook Integration Tests", () => {
  beforeEach(async () => {
    // Reset modules to ensure fresh imports
    vi.resetModules()
    vi.clearAllMocks()
    // Reset all mocks to successful defaults
    mockStripeProvider.verifyWebhookSignature.mockResolvedValue({})
    mockBTCPayProvider.verifyWebhookSignature.mockResolvedValue({})
    mockSubscriptionService.handleStripeWebhook.mockResolvedValue(undefined)
    mockSubscriptionService.handleBTCPayWebhook.mockResolvedValue(undefined)
    mockEmailService.sendAdminAlert.mockResolvedValue(undefined)
    // Reset database lookup to return nothing by default
    mockDbState.lookupResult = []

    // Setup database mock with current state
    const { getDatabase } = await import("@/lib/db/drizzle")
    vi.mocked(getDatabase).mockImplementation(() =>
      Promise.resolve({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockImplementation(() =>
                  Promise.resolve(mockDbState.lookupResult),
                ),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      } as any),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Stripe Webhook Processing", () => {
    it("should handle customer.subscription.created event", async () => {
      // Arrange
      const webhookEvent = {
        type: "customer.subscription.created",
        id: "evt_test123",
        data: {
          object: {
            id: "sub_test123",
            customer: "cus_test123",
            status: "active",
            current_period_start: 1609459200,
            current_period_end: 1612137600,
            cancel_at_period_end: false,
            metadata: { user_id: "user123" },
            items: {
              data: [{ price: { id: "price_pro_monthly" } }],
            },
          },
        },
      }

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockStripeProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(webhookEvent),
        "test-signature",
        "test-stripe-secret",
      )
      expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(
        webhookEvent,
        "user123",
      )
    })

    it.skip("should handle customer.subscription.deleted event", async () => {
      // Arrange
      const webhookEvent = {
        type: "customer.subscription.deleted",
        id: "evt_test124",
        data: {
          object: {
            id: "sub_test123",
            metadata: { user_id: "user123" },
          },
        },
      }

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
    })

    it.skip("should handle invoice.payment_failed event", async () => {
      // Arrange
      const webhookEvent = {
        type: "invoice.payment_failed",
        id: "evt_test125",
        data: {
          object: {
            id: "in_test123",
            subscription: "sub_test123",
            customer: "cus_test123",
            amount_paid: 0,
            metadata: { user_id: "user123" },
          },
        },
      }

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
    })

    it("should reject webhook without signature", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify({ type: "test" }),
          headers: {
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("No signature provided")
    })

    it("should handle signature verification failure", async () => {
      // Arrange
      mockStripeProvider.verifyWebhookSignature.mockRejectedValue(
        new Error("Invalid webhook signature"),
      )

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify({ type: "test" }),
          headers: {
            "stripe-signature": "invalid-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(401)
    })

    it("should fall back to database lookup when metadata is empty", async () => {
      // Arrange - webhook with empty metadata (common when cancelled via Stripe dashboard)
      const webhookEvent = {
        type: "customer.subscription.deleted",
        id: "evt_test_no_metadata",
        data: {
          object: {
            id: "sub_test456",
            customer: "cus_test456",
            status: "canceled",
            metadata: {}, // Empty metadata - the bug scenario
          },
        },
      }

      // Mock database to return user by subscription ID
      mockDbState.lookupResult = [{ userId: "user456" }]

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(
        webhookEvent,
        "user456",
      )
      // Should NOT send admin alert since we found the user
      expect(mockEmailService.sendAdminAlert).not.toHaveBeenCalled()
    })

    it("should fall back to customer ID lookup when subscription ID not found", async () => {
      // Arrange - webhook with empty metadata, lookup by customer ID
      const webhookEvent = {
        type: "customer.subscription.updated",
        id: "evt_test_customer_lookup",
        data: {
          object: {
            id: "sub_unknown",
            customer: "cus_known789",
            status: "active",
            metadata: {},
          },
        },
      }

      // Mock database to return user by customer ID
      mockDbState.lookupResult = [{ userId: "user789" }]

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(
        webhookEvent,
        "user789",
      )
    })

    it("should send admin alert when user cannot be found by any method", async () => {
      // Arrange - webhook with empty metadata and no matching database record
      const webhookEvent = {
        type: "customer.subscription.deleted",
        id: "evt_test_orphan",
        data: {
          object: {
            id: "sub_orphan",
            customer: "cus_orphan",
            status: "canceled",
            metadata: {},
          },
        },
      }

      // Mock database to return nothing
      mockDbState.lookupResult = []

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("No user_id in metadata")

      // Should send admin alert
      expect(mockEmailService.sendAdminAlert).toHaveBeenCalledWith({
        type: "webhook_failure",
        severity: "medium",
        message: "Stripe webhook missing user_id",
        details: expect.objectContaining({
          eventType: "customer.subscription.deleted",
          eventId: "evt_test_orphan",
          provider: "stripe",
        }),
      })
    })

    it("should prefer metadata user_id over database lookup", async () => {
      // Arrange - webhook with metadata (should use metadata, not database)
      const webhookEvent = {
        type: "customer.subscription.created",
        id: "evt_test_with_metadata",
        data: {
          object: {
            id: "sub_test_meta",
            customer: "cus_test_meta",
            status: "active",
            metadata: { user_id: "user_from_metadata" },
          },
        },
      }

      // Mock database to return a different user (should NOT be used)
      mockDbState.lookupResult = [{ userId: "user_from_database" }]

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "stripe-signature": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      // Should use metadata user_id, not database lookup
      expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(
        webhookEvent,
        "user_from_metadata",
      )
    })
  })

  describe("BTCPay Webhook Processing", () => {
    it.skip("should handle InvoiceSettled event for subscription", async () => {
      // Arrange
      const webhookEvent = {
        type: "InvoiceSettled",
        id: "evt_btc_test123",
        data: {
          object: {
            id: "invoice123",
            metadata: {
              user_id: "user123",
              mode: "subscription",
              interval: "month",
            },
          },
        },
      }

      mockBTCPayProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/btcpay",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "btcpay-sig": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockBTCPayProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(webhookEvent),
        "test-signature",
        "test-btcpay-secret",
      )
      expect(mockSubscriptionService.handleBTCPayWebhook).toHaveBeenCalledWith(
        webhookEvent,
        "user123",
      )
    })

    it.skip("should handle InvoiceExpired event", async () => {
      // Arrange
      const webhookEvent = {
        type: "InvoiceExpired",
        id: "evt_btc_test124",
        data: {
          object: {
            id: "invoice123",
            metadata: { user_id: "user123" },
          },
        },
      }

      mockBTCPayProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent)

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/btcpay",
        {
          method: "POST",
          body: JSON.stringify(webhookEvent),
          headers: {
            "btcpay-sig": "test-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
    })

    it("should reject BTCPay webhook without signature", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/btcpay",
        {
          method: "POST",
          body: JSON.stringify({ type: "test" }),
          headers: {
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("No signature provided")
    })

    it("should handle BTCPay signature verification failure", async () => {
      // Arrange
      mockBTCPayProvider.verifyWebhookSignature.mockRejectedValue(
        new Error("Invalid webhook signature"),
      )

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/btcpay",
        {
          method: "POST",
          body: JSON.stringify({ type: "test" }),
          headers: {
            "btcpay-sig": "invalid-signature",
            "content-type": "application/json",
          },
        },
      )

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route")
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Invalid webhook signature")
    })
  })
})
