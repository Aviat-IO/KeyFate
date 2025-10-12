import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { subscriptionService } from "@/lib/services/subscription-service";
import { getDatabase } from "@/lib/db/drizzle";
import { userSubscriptions, paymentHistory, auditLogs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/server-env", () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://test",
  },
}));

vi.mock("@/lib/services/email-service", () => ({
  emailService: {
    sendSubscriptionConfirmation: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailedNotification: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledNotification: vi.fn().mockResolvedValue(undefined),
    sendTrialWillEndNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Payment and Subscription Integration Tests", () => {
  const testUserId = "test-user-" + Date.now();

  beforeEach(async () => {
    const db = await getDatabase();
    
    await db.insert(users).values({
      id: testUserId,
      email: `test-${testUserId}@example.com`,
      name: "Test User",
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  afterEach(async () => {
    const db = await getDatabase();
    
    try {
      await db.delete(auditLogs).where(eq(auditLogs.userId, testUserId));
      await db.delete(paymentHistory).where(eq(paymentHistory.userId, testUserId));
      await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Stripe Payment Flow", () => {
    it("should create subscription, payment_history, and audit_logs on checkout.session.completed", async () => {
      const checkoutEvent = {
        type: "checkout.session.completed",
        id: "evt_test_checkout_" + Date.now(),
        data: {
          object: {
            id: "cs_test_123",
            mode: "subscription",
            customer: "cus_test_123",
            subscription: "sub_test_123",
            metadata: { user_id: testUserId },
          },
        },
      };

      await subscriptionService.handleStripeWebhook(checkoutEvent, testUserId);

      const db = await getDatabase();

      const subscription = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, testUserId))
        .limit(1);

      expect(subscription).toHaveLength(1);
      expect(subscription[0].userId).toBe(testUserId);
      expect(subscription[0].provider).toBe("stripe");
      expect(subscription[0].status).toBe("active");

      const auditLog = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId))
        .limit(1);

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].eventType).toBe("subscription_changed");
    });

    it("should create payment_history record on invoice.payment_succeeded", async () => {
      await subscriptionService.createSubscription({
        userId: testUserId,
        provider: "stripe",
        providerCustomerId: "cus_test_123",
        providerSubscriptionId: "sub_test_123",
        tierName: "pro",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const paymentEvent = {
        type: "invoice.payment_succeeded",
        id: "evt_test_payment_" + Date.now(),
        data: {
          object: {
            id: "in_test_123",
            payment_intent: "pi_test_123",
            amount_paid: 900,
            currency: "usd",
            subscription: "sub_test_123",
            metadata: { user_id: testUserId },
          },
        },
      };

      await subscriptionService.handleStripeWebhook(paymentEvent, testUserId);

      const db = await getDatabase();

      const payments = await db
        .select()
        .from(paymentHistory)
        .where(eq(paymentHistory.userId, testUserId));

      expect(payments).toHaveLength(1);
      expect(payments[0].userId).toBe(testUserId);
      expect(payments[0].provider).toBe("stripe");
      expect(payments[0].status).toBe("succeeded");
      expect(payments[0].amount).toBe("9");
      expect(payments[0].currency).toBe("USD");
      expect(payments[0].providerPaymentId).toBe("pi_test_123");

      const auditLogs2 = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      expect(auditLogs2.length).toBeGreaterThanOrEqual(2);
      const paymentLog = auditLogs2.find(
        (log) => log.details && (log.details as any).action === "payment_processed"
      );
      expect(paymentLog).toBeDefined();
    });

    it("should create failed payment_history record on invoice.payment_failed", async () => {
      await subscriptionService.createSubscription({
        userId: testUserId,
        provider: "stripe",
        providerCustomerId: "cus_test_123",
        providerSubscriptionId: "sub_test_123",
        tierName: "pro",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const failedPaymentEvent = {
        type: "invoice.payment_failed",
        id: "evt_test_failed_" + Date.now(),
        data: {
          object: {
            id: "in_test_failed_123",
            payment_intent: "pi_test_failed_123",
            amount_due: 900,
            currency: "usd",
            subscription: "sub_test_123",
            attempt_count: 1,
            last_payment_error: {
              message: "Card declined",
            },
            metadata: { user_id: testUserId },
          },
        },
      };

      await subscriptionService.handleStripeWebhook(failedPaymentEvent, testUserId);

      const db = await getDatabase();

      const payments = await db
        .select()
        .from(paymentHistory)
        .where(eq(paymentHistory.userId, testUserId));

      expect(payments).toHaveLength(1);
      expect(payments[0].status).toBe("failed");
      expect(payments[0].failureReason).toBe("Card declined");
      expect(payments[0].amount).toBe("9");

      const subscription = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, testUserId))
        .limit(1);

      expect(subscription[0].status).toBe("past_due");
    });

    it("should update subscription status on customer.subscription.deleted", async () => {
      await subscriptionService.createSubscription({
        userId: testUserId,
        provider: "stripe",
        providerCustomerId: "cus_test_123",
        providerSubscriptionId: "sub_test_123",
        tierName: "pro",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const cancelEvent = {
        type: "customer.subscription.deleted",
        id: "evt_test_cancel_" + Date.now(),
        data: {
          object: {
            id: "sub_test_123",
            metadata: { user_id: testUserId },
          },
        },
      };

      await subscriptionService.handleStripeWebhook(cancelEvent, testUserId);

      const db = await getDatabase();

      const subscription = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, testUserId))
        .limit(1);

      expect(subscription[0].status).toBe("cancelled");
    });
  });

  describe("BTCPay Payment Flow", () => {
    it("should create subscription and payment_history on InvoiceSettled", async () => {
      const btcpayEvent = {
        type: "InvoiceSettled",
        id: "evt_btc_test_" + Date.now(),
        data: {
          object: {
            id: "btcpay_invoice_123",
            amount: 0.0012,
            currency: "BTC",
            metadata: {
              user_id: testUserId,
              mode: "subscription",
              tierName: "pro",
              interval: "month",
            },
          },
        },
      };

      await subscriptionService.handleBTCPayWebhook(btcpayEvent, testUserId);

      const db = await getDatabase();

      const subscription = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, testUserId))
        .limit(1);

      expect(subscription).toHaveLength(1);
      expect(subscription[0].userId).toBe(testUserId);
      expect(subscription[0].provider).toBe("btcpay");
      expect(subscription[0].status).toBe("active");

      const payments = await db
        .select()
        .from(paymentHistory)
        .where(eq(paymentHistory.userId, testUserId));

      expect(payments).toHaveLength(1);
      expect(payments[0].provider).toBe("btcpay");
      expect(payments[0].status).toBe("succeeded");
      expect(payments[0].currency).toBe("BTC");

      const auditLog = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      expect(auditLog.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Subscription Lifecycle", () => {
    it("should maintain consistent state across subscription updates", async () => {
      const subscription = await subscriptionService.createSubscription({
        userId: testUserId,
        provider: "stripe",
        providerCustomerId: "cus_test_123",
        providerSubscriptionId: "sub_test_123",
        tierName: "pro",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(testUserId);

      await subscriptionService.updateSubscription(testUserId, {
        status: "past_due",
      });

      const db = await getDatabase();
      const updated = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, testUserId))
        .limit(1);

      expect(updated[0].status).toBe("past_due");

      await subscriptionService.cancelSubscription(testUserId, true);

      const cancelled = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, testUserId))
        .limit(1);

      expect(cancelled[0].status).toBe("cancelled");
    });
  });
});
