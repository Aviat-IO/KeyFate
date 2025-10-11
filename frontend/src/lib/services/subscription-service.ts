import { getDatabase } from "@/lib/db/drizzle";
import {
  subscriptionStatusEnum,
  subscriptionTierEnum,
  subscriptionTiers,
  userSubscriptions,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { emailService } from "./email-service";

export type SubscriptionProvider = "stripe" | "btcpay";
export type SubscriptionStatus =
  typeof subscriptionStatusEnum.enumValues[number];
export type SubscriptionTier = typeof subscriptionTierEnum.enumValues[number];

export interface CreateSubscriptionData {
  userId: string;
  provider: SubscriptionProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  tierName: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
}

export interface UpdateSubscriptionData {
  tierName?: SubscriptionTier;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

class SubscriptionService {
  async createSubscription(data: CreateSubscriptionData) {
    const db = await getDatabase();
    try {
      // Get tier ID from tier name
      const tier = await this.getTierByName(data.tierName);
      if (!tier) {
        throw new Error(`Tier ${data.tierName} not found`);
      }

      // Insert full record (cast for Drizzle typing quirks)
      const [subscription] = await db
        .insert(userSubscriptions)
        .values({
          userId: data.userId,
          tierId: tier.id,
          provider: data.provider,
          providerCustomerId: data.providerCustomerId,
          providerSubscriptionId: data.providerSubscriptionId,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      // Send confirmation email (don't await to avoid blocking)
      this.sendSubscriptionConfirmationEmail(data.userId, {
        provider: data.provider,
        tierName: data.tierName,
        status: data.status,
      }).catch((error) => {
        console.error("Failed to send subscription confirmation email:", error);
      });

      return subscription;
    } catch (error) {
      console.error("Failed to create subscription:", error);
      throw error;
    }
  }

  async updateSubscription(userId: string, data: UpdateSubscriptionData) {
    const db = await getDatabase();
    try {
      // Get tier ID if tier name is provided
      let tierId: string | undefined;
      if (data.tierName) {
        const tier = await this.getTierByName(data.tierName);
        if (!tier) {
          throw new Error(`Tier ${data.tierName} not found`);
        }
        tierId = tier.id;
      }

      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      };

      if (tierId) {
        updateData.tierId = tierId;
        delete updateData.tierName;
      }

      const [subscription] = await db
        .update(userSubscriptions)
        .set(updateData)
        .where(eq(userSubscriptions.userId, userId))
        .returning();

      return subscription;
    } catch (error) {
      console.error("Failed to update subscription:", error);
      throw error;
    }
  }

  async updateSubscriptionStatus(userId: string, status: SubscriptionStatus) {
    return this.updateSubscription(userId, { status });
  }

  async cancelSubscription(userId: string, immediate: boolean = false) {
    try {
      const updateData: UpdateSubscriptionData = immediate
        ? { status: "cancelled", cancelAtPeriodEnd: false }
        : { cancelAtPeriodEnd: true };

      const subscription = await this.updateSubscription(userId, updateData);

      // Send cancellation email (don't await to avoid blocking)
      this.sendCancellationEmail(userId).catch((error) => {
        console.error("Failed to send cancellation email:", error);
      });

      return subscription;
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      throw error;
    }
  }

  async getUserSubscription(userId: string) {
    const db = await getDatabase();
    try {
      const subscription = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);

      return subscription[0] || null;
    } catch (error) {
      console.error("Failed to get user subscription:", error);
      throw error;
    }
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const db = await getDatabase();
    try {
      const subscription = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            eq(userSubscriptions.status, "active"),
          ),
        )
        .limit(1);

      return subscription.length > 0;
    } catch (error) {
      console.error("Failed to check active subscription:", error);
      return false;
    }
  }

  async updateUserTier(userId: string, tierName: SubscriptionTier) {
    try {
      const tier = await this.getTierByName(tierName);
      if (!tier) {
        throw new Error(`Tier ${tierName} not found`);
      }

      // Update subscription tier
      await this.updateSubscription(userId, { tierName });

      return tier;
    } catch (error) {
      console.error("Failed to update user tier:", error);
      throw error;
    }
  }

  async getTierByName(tierName: SubscriptionTier) {
    const db = await getDatabase();
    try {
      const [tier] = await db
        .select()
        .from(subscriptionTiers)
        .where(eq(subscriptionTiers.name, tierName))
        .limit(1);

      return tier || null;
    } catch (error) {
      console.error("Failed to get tier by name:", error);
      throw error;
    }
  }

  async getSubscriptionsByProvider(provider: SubscriptionProvider) {
    const db = await getDatabase();
    try {
      return await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.provider, provider));
    } catch (error) {
      console.error("Failed to get subscriptions by provider:", error);
      throw error;
    }
  }

  async getSubscriptionByProviderSubscriptionId(
    provider: SubscriptionProvider,
    providerSubscriptionId: string,
  ) {
    const db = await getDatabase();
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(
            eq(userSubscriptions.provider, provider),
            eq(
              userSubscriptions.providerSubscriptionId,
              providerSubscriptionId,
            ),
          ),
        )
        .limit(1);

      return subscription || null;
    } catch (error) {
      console.error(
        "Failed to get subscription by provider subscription ID:",
        error,
      );
      throw error;
    }
  }

  // Grace period handling for failed payments
  async handlePaymentFailure(userId: string, attemptCount: number = 1) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error("Subscription not found");
      }

      // Update status to past_due on first failure
      if (attemptCount === 1) {
        await this.updateSubscriptionStatus(userId, "past_due");
      }

      // Send payment failure notification
      emailService.sendPaymentFailedNotification(userId, {
        provider: subscription.provider as SubscriptionProvider,
        subscriptionId: subscription.providerSubscriptionId,
        amount: 1999, // This should come from the subscription tier
        attemptCount,
        nextRetry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }).catch((error) => {
        console.error("Failed to send payment failure notification:", error);
      });

      // Cancel subscription after 3 failed attempts
      if (attemptCount >= 3) {
        await this.cancelSubscription(userId, true);
      }

      return subscription;
    } catch (error) {
      console.error("Failed to handle payment failure:", error);
      throw error;
    }
  }

  // Private helper methods
  private async sendSubscriptionConfirmationEmail(
    userId: string,
    subscriptionData: {
      provider: SubscriptionProvider;
      tierName: SubscriptionTier;
      status: SubscriptionStatus;
    },
  ) {
    try {
      await emailService.sendSubscriptionConfirmation(userId, {
        provider: subscriptionData.provider,
        tierName: subscriptionData.tierName,
        amount: 1999, // This should come from the tier pricing
        interval: "month", // This should be determined from the subscription
      });
    } catch (error) {
      console.error("Failed to send subscription confirmation email:", error);
      // Don't throw - email failures shouldn't break subscription creation
    }
  }

  private async sendCancellationEmail(userId: string) {
    try {
      await emailService.sendSubscriptionCancelledNotification(userId);
    } catch (error) {
      console.error("Failed to send cancellation email:", error);
      // Don't throw - email failures shouldn't break cancellation
    }
  }

  // Webhook helper methods
  async handleStripeWebhook(event: any, userId: string) {
    try {
      switch (event.type) {
        case "checkout.session.completed":
          return await this.handleCheckoutSessionCompleted(event, userId);

        case "customer.subscription.created":
        case "customer.subscription.updated":
          return await this.handleSubscriptionUpdate(event, userId);

        case "customer.subscription.deleted":
          return await this.handleSubscriptionCancellation(event, userId);

        case "invoice.payment_succeeded":
          return await this.handlePaymentSuccess(event, userId);

        case "invoice.payment_failed":
          return await this.handlePaymentFailed(event, userId);

        case "customer.subscription.trial_will_end":
          return await this.handleTrialWillEnd(event, userId);

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Failed to handle Stripe webhook:", error);
      throw error;
    }
  }

  async handleBTCPayWebhook(event: any, userId: string) {
    try {
      switch (event.type) {
        case "InvoiceSettled":
          return await this.handleBitcoinPaymentSettled(event, userId);

        case "InvoiceExpired":
          return await this.handleBitcoinInvoiceExpired(event, userId);

        case "InvoiceInvalid":
          return await this.handleBitcoinInvoiceInvalid(event, userId);

        default:
          console.log(`Unhandled BTCPay event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Failed to handle BTCPay webhook:", error);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(event: any, userId: string) {
    const session = event.data.object;
    
    if (session.mode === "subscription" && session.subscription) {
      console.log(`[Subscription] Checkout completed for user ${userId}, subscription: ${session.subscription}`);
      
      const subscriptionId = typeof session.subscription === 'string' 
        ? session.subscription 
        : session.subscription.id;
      
      await this.createOrUpdateSubscriptionFromCheckout(
        userId,
        session.customer,
        subscriptionId,
        session
      );
    }
  }

  private async createOrUpdateSubscriptionFromCheckout(
    userId: string,
    customerId: string,
    subscriptionId: string,
    session: any
  ) {
    try {
      const existingSubscription = await this.getUserSubscription(userId);
      
      if (existingSubscription) {
        console.log(`[Subscription] Updating existing subscription for user ${userId}`);
        return await this.updateSubscription(userId, {
          status: "active",
        });
      } else {
        console.log(`[Subscription] Creating new subscription for user ${userId}`);
        
        const subscriptionData: CreateSubscriptionData = {
          userId,
          provider: "stripe",
          providerCustomerId: customerId,
          providerSubscriptionId: subscriptionId,
          tierName: "premium",
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        };
        
        return await this.createSubscription(subscriptionData);
      }
    } catch (error) {
      console.error("Failed to create/update subscription from checkout:", error);
      throw error;
    }
  }

  private async handleSubscriptionUpdate(event: any, userId: string) {
    const subscription = event.data.object;
    const tier = this.getTierFromStripePrice(
      subscription.items.data[0].price.id,
    );

    const subscriptionData: CreateSubscriptionData = {
      userId,
      provider: "stripe",
      providerCustomerId: subscription.customer,
      providerSubscriptionId: subscription.id,
      tierName: tier,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    const existingSubscription = await this.getUserSubscription(userId);
    if (existingSubscription) {
      return await this.updateSubscription(userId, {
        tierName: tier,
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: subscriptionData.currentPeriodStart,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } else {
      return await this.createSubscription(subscriptionData);
    }
  }

  private async handleSubscriptionCancellation(event: any, userId: string) {
    return await this.cancelSubscription(userId, true);
  }

  private async handlePaymentSuccess(event: any, userId: string) {
    // Reactivate subscription if it was past_due
    const subscription = await this.getUserSubscription(userId);
    if (subscription && subscription.status === "past_due") {
      await this.updateSubscriptionStatus(userId, "active");
    }
  }

  private async handlePaymentFailed(event: any, userId: string) {
    const invoice = event.data.object;
    const attemptCount = invoice.attempt_count || 1;
    return await this.handlePaymentFailure(userId, attemptCount);
  }

  private async handleTrialWillEnd(event: any, userId: string) {
    try {
      await emailService.sendTrialWillEndNotification(userId, {
        daysRemaining: 3, // This should be calculated from the trial end date
        trialEndDate: new Date(event.data.object.trial_end * 1000),
      });
    } catch (error) {
      console.error("Failed to send trial will end notification:", error);
    }
  }

  private async handleBitcoinPaymentSettled(event: any, userId: string) {
    const invoice = event.data.object;
    const metadata = invoice.metadata || {};

    if (metadata.mode === "subscription") {
      const subscriptionData: CreateSubscriptionData = {
        userId,
        provider: "btcpay",
        providerCustomerId: null,
        providerSubscriptionId: invoice.id,
        tierName: (metadata.tierName as SubscriptionTier) || "basic", // fallback
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculateNextBillingDate(
          metadata.interval || "month",
        ),
      };

      return await this.createSubscription(subscriptionData);
    }
  }

  private async handleBitcoinInvoiceExpired(event: any, userId: string) {
    console.log(`Bitcoin invoice expired for user ${userId}`);
    // Could send notification or update subscription status
  }

  private async handleBitcoinInvoiceInvalid(event: any, userId: string) {
    console.log(`Bitcoin invoice invalid for user ${userId}`);
    // Could send notification or handle as payment failure
  }

  private getTierFromStripePrice(priceId: string): SubscriptionTier {
    const priceToTierMap: Record<string, SubscriptionTier> = {
      price_pro_monthly: "premium",
      price_pro_yearly: "premium",
      pro_monthly: "premium",
      pro_yearly: "premium",
      price_basic_monthly: "basic",
      price_basic_yearly: "basic",
    };

    return priceToTierMap[priceId] || "free";
  }

  private calculateNextBillingDate(interval: string): Date {
    const now = new Date();
    switch (interval) {
      case "month":
        now.setMonth(now.getMonth() + 1);
        return now;
      case "year":
        now.setFullYear(now.getFullYear() + 1);
        return now;
      default:
        now.setMonth(now.getMonth() + 1);
        return now;
    }
  }
}

export const subscriptionService = new SubscriptionService();
