/**
 * Webhook Event Handlers
 *
 * Stripe and BTCPay webhook event processing logic.
 * Extracted from subscription-service.ts for maintainability.
 */

import { logger } from "$lib/logger"
import { getTierFromStripePrice, calculateNextBillingDate } from "./tier-service"
import {
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getUserSubscription,
  updateSubscriptionStatus,
  handlePaymentFailure,
} from "./subscription-lifecycle"
import { createPaymentRecord } from "./payment-records"
import { emailService } from "$lib/email/email-service"
import type {
  SubscriptionProvider,
  SubscriptionStatus,
  CreateSubscriptionData,
} from "./subscription-service.types"

// ── Stripe ──────────────────────────────────────────────────────────

/**
 * Route a Stripe webhook event to the appropriate handler.
 */
export async function handleStripeWebhook(event: any, userId: string) {
  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleCheckoutSessionCompleted(event, userId)

      case "customer.subscription.created":
      case "customer.subscription.updated":
        return await handleSubscriptionUpdate(event, userId)

      case "customer.subscription.deleted":
        return await handleSubscriptionCancellation(event, userId)

      case "invoice.payment_succeeded":
        return await handlePaymentSuccess(event, userId)

      case "invoice.payment_failed":
        return await handlePaymentFailed(event, userId)

      case "customer.subscription.trial_will_end":
        return await handleTrialWillEnd(event, userId)

      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`)
    }
  } catch (error) {
    logger.error(
      "Failed to handle Stripe webhook",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

// ── BTCPay ──────────────────────────────────────────────────────────

/**
 * Route a BTCPay webhook event to the appropriate handler.
 */
export async function handleBTCPayWebhook(event: any, userId: string) {
  try {
    switch (event.type) {
      case "InvoiceSettled":
        return await handleBitcoinPaymentSettled(event, userId)

      case "InvoiceExpired":
        return await handleBitcoinInvoiceExpired(event, userId)

      case "InvoiceInvalid":
        return await handleBitcoinInvoiceInvalid(event, userId)

      default:
        logger.info(`Unhandled BTCPay event type: ${event.type}`)
    }
  } catch (error) {
    logger.error(
      "Failed to handle BTCPay webhook",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

// ── Stripe handlers (private) ───────────────────────────────────────

async function handleCheckoutSessionCompleted(event: any, userId: string) {
  const session = event.data.object

  if (session.mode === "subscription" && session.subscription) {
    logger.info("Checkout completed", {
      userId,
      subscription: typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id,
    })

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id

    await createOrUpdateSubscriptionFromCheckout(
      userId,
      session.customer,
      subscriptionId,
      session,
    )
  }
}

async function createOrUpdateSubscriptionFromCheckout(
  userId: string,
  customerId: string,
  subscriptionId: string,
  _session: any,
) {
  try {
    const existingSubscription = await getUserSubscription(userId)

    if (existingSubscription) {
      logger.info("Updating existing subscription from checkout", { userId })
      return await updateSubscription(userId, {
        status: "active",
      })
    } else {
      logger.info("Creating new subscription from checkout", { userId })

      const subscriptionData: CreateSubscriptionData = {
        userId,
        provider: "stripe",
        providerCustomerId: customerId,
        providerSubscriptionId: subscriptionId,
        tierName: "pro",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      }

      return await createSubscription(subscriptionData)
    }
  } catch (error) {
    logger.error(
      "Failed to create/update subscription from checkout",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

async function handleSubscriptionUpdate(event: any, userId: string) {
  const subscription = event.data.object
  const tier = getTierFromStripePrice(
    subscription.items.data[0].price.id,
  )

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
  }

  const existingSubscription = await getUserSubscription(userId)
  if (existingSubscription) {
    return await updateSubscription(userId, {
      tierName: tier,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscriptionData.currentPeriodStart,
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
  } else {
    return await createSubscription(subscriptionData)
  }
}

async function handleSubscriptionCancellation(_event: any, userId: string) {
  return await cancelSubscription(userId, true)
}

async function handlePaymentSuccess(event: any, userId: string) {
  const invoice = event.data.object

  const subscription = await getUserSubscription(userId)

  if (subscription) {
    await createPaymentRecord({
      userId,
      subscriptionId: subscription.id,
      provider: "stripe",
      providerPaymentId: invoice.payment_intent || invoice.id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency?.toUpperCase() || "USD",
      status: "succeeded",
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
      },
    })

    if (subscription.status === "past_due") {
      await updateSubscriptionStatus(userId, "active")
    }
  }
}

async function handlePaymentFailed(event: any, userId: string) {
  const invoice = event.data.object
  const attemptCount = invoice.attempt_count || 1

  const subscription = await getUserSubscription(userId)

  if (subscription) {
    await createPaymentRecord({
      userId,
      subscriptionId: subscription.id,
      provider: "stripe",
      providerPaymentId: invoice.payment_intent || invoice.id,
      amount: invoice.amount_due / 100,
      currency: invoice.currency?.toUpperCase() || "USD",
      status: "failed",
      failureReason: invoice.last_payment_error?.message || "Payment failed",
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        attemptCount,
      },
    })
  }

  return await handlePaymentFailure(userId, attemptCount)
}

async function handleTrialWillEnd(event: any, userId: string) {
  try {
    await emailService.sendTrialWillEndNotification(userId, {
      daysRemaining: 3,
      trialEndDate: new Date(event.data.object.trial_end * 1000),
    })
  } catch (error) {
    logger.error(
      "Failed to send trial will end notification",
      error instanceof Error ? error : undefined,
    )
  }
}

// ── BTCPay handlers (private) ───────────────────────────────────────

async function handleBitcoinPaymentSettled(event: any, userId: string) {
  const invoice = event.data.object
  const metadata = invoice.metadata || {}

  logger.info("Bitcoin payment settled", {
    userId,
    invoiceId: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
  })

  const isSubscription = !!metadata.billing_interval

  if (isSubscription) {
    const billingInterval = metadata.billing_interval as string
    const tierName = "pro"

    logger.info("Creating subscription for Bitcoin payment", {
      userId,
      tierName,
      billingInterval,
    })

    const subscriptionData: CreateSubscriptionData = {
      userId,
      provider: "btcpay",
      providerCustomerId: null,
      providerSubscriptionId: invoice.id,
      tierName,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: calculateNextBillingDate(billingInterval),
    }

    const subscription = await createSubscription(subscriptionData)

    const amountNumber = parseFloat(invoice.amount) || 0

    await createPaymentRecord({
      userId,
      subscriptionId: subscription.id,
      provider: "btcpay",
      providerPaymentId: invoice.id,
      amount: amountNumber,
      currency: invoice.currency || "USD",
      status: "succeeded",
      metadata: {
        invoiceId: invoice.id,
        btcpayInvoiceId: invoice.id,
        billingInterval,
        originalAmount: metadata.original_amount,
        originalCurrency: metadata.original_currency,
      },
    })

    logger.info("Subscription created successfully", {
      subscriptionId: subscription.id,
      userId,
      tierName,
    })

    return subscription
  } else {
    logger.info(
      "BTCPay payment settled but not a subscription (no billing_interval)",
    )
  }
}

async function handleBitcoinInvoiceExpired(_event: any, userId: string) {
  logger.info(`Bitcoin invoice expired for user ${userId}`)
}

async function handleBitcoinInvoiceInvalid(_event: any, userId: string) {
  logger.info(`Bitcoin invoice invalid for user ${userId}`)
}
