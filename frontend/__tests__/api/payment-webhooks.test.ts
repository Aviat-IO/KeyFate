import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
}));

vi.mock("@/lib/server-env", () => ({
  serverEnv: {
    STRIPE_WEBHOOK_SECRET: "test-stripe-secret",
    BTCPAY_WEBHOOK_SECRET: "test-btcpay-secret",
  },
}));

// Mock payment providers
const mockStripeProvider = {
  verifyWebhookSignature: vi.fn(),
};

const mockBTCPayProvider = {
  verifyWebhookSignature: vi.fn(),
};

vi.mock("@/lib/payment", () => ({
  getFiatPaymentProvider: () => mockStripeProvider,
  getCryptoPaymentProvider: () => mockBTCPayProvider,
}));

// Mock subscription service
const mockSubscriptionService = {
  handleStripeWebhook: vi.fn(),
  handleBTCPayWebhook: vi.fn(),
};

vi.mock("@/lib/services/subscription-service", () => ({
  subscriptionService: mockSubscriptionService,
}));

// Mock email service
const mockEmailService = {
  sendAdminAlert: vi.fn(),
};

vi.mock("@/lib/services/email-service", () => ({
  emailService: mockEmailService,
}));

describe("Payment Webhook Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mocks to successful defaults
    mockStripeProvider.verifyWebhookSignature.mockResolvedValue({});
    mockBTCPayProvider.verifyWebhookSignature.mockResolvedValue({});
    mockSubscriptionService.handleStripeWebhook.mockResolvedValue(undefined);
    mockSubscriptionService.handleBTCPayWebhook.mockResolvedValue(undefined);
    mockEmailService.sendAdminAlert.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      };

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(webhookEvent),
        headers: {
          "stripe-signature": "test-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockStripeProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(webhookEvent),
        "test-signature",
        "test-stripe-secret"
      );
      expect(mockSubscriptionService.handleStripeWebhook).toHaveBeenCalledWith(webhookEvent, "user123");
    });

    it("should handle customer.subscription.deleted event", async () => {
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
      };

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(webhookEvent),
        headers: {
          "stripe-signature": "test-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it("should handle invoice.payment_failed event", async () => {
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
      };

      mockStripeProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(webhookEvent),
        headers: {
          "stripe-signature": "test-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it("should reject webhook without signature", async () => {
      // Arrange
      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("No signature provided");
    });

    it("should handle signature verification failure", async () => {
      // Arrange
      mockStripeProvider.verifyWebhookSignature.mockRejectedValue(
        new Error("Invalid webhook signature")
      );

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "stripe-signature": "invalid-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/stripe/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe("BTCPay Webhook Processing", () => {
    it("should handle InvoiceSettled event for subscription", async () => {
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
      };

      mockBTCPayProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent);

      const request = new NextRequest("http://localhost:3000/api/webhooks/btcpay", {
        method: "POST",
        body: JSON.stringify(webhookEvent),
        headers: {
          "btcpay-sig": "test-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockBTCPayProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(webhookEvent),
        "test-signature",
        "test-btcpay-secret"
      );
      expect(mockSubscriptionService.handleBTCPayWebhook).toHaveBeenCalledWith(webhookEvent, "user123");
    });

    it("should handle InvoiceExpired event", async () => {
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
      };

      mockBTCPayProvider.verifyWebhookSignature.mockResolvedValue(webhookEvent);

      const request = new NextRequest("http://localhost:3000/api/webhooks/btcpay", {
        method: "POST",
        body: JSON.stringify(webhookEvent),
        headers: {
          "btcpay-sig": "test-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it("should reject BTCPay webhook without signature", async () => {
      // Arrange
      const request = new NextRequest("http://localhost:3000/api/webhooks/btcpay", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("No signature provided");
    });

    it("should handle BTCPay signature verification failure", async () => {
      // Arrange
      mockBTCPayProvider.verifyWebhookSignature.mockRejectedValue(
        new Error("Invalid webhook signature")
      );

      const request = new NextRequest("http://localhost:3000/api/webhooks/btcpay", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "btcpay-sig": "invalid-signature",
          "content-type": "application/json",
        },
      });

      // Act
      const { POST } = await import("@/app/api/webhooks/btcpay/route");
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Invalid webhook signature");
    });
  });
});