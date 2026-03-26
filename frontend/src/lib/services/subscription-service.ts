/**
 * Subscription Service — Facade
 *
 * This file preserves the original public API (the `subscriptionService`
 * singleton and all exported types) while delegating to focused modules:
 *
 *   tier-service.ts          — tier lookup, creation, Stripe price mapping
 *   subscription-lifecycle.ts — CRUD, cancel, downgrade scheduling
 *   webhook-handlers.ts      — Stripe & BTCPay event processing
 *   payment-records.ts       — payment history persistence
 *   subscription-service.types.ts — shared type definitions
 */

// Re-export types for backward compatibility
export type {
  SubscriptionProvider,
  SubscriptionStatus,
  SubscriptionTier,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from "./subscription-service.types"

// Re-export tier utilities
export { getTierByName, getTierFromStripePrice, calculateNextBillingDate } from "./tier-service"

// Re-export lifecycle functions
export {
  createSubscription,
  updateSubscription,
  updateSubscriptionStatus,
  cancelSubscription,
  getUserSubscription,
  hasActiveSubscription,
  updateUserTier,
  getSubscriptionsByProvider,
  getSubscriptionByProviderSubscriptionId,
  handlePaymentFailure,
  scheduleDowngrade,
  cancelScheduledDowngrade,
  executeScheduledDowngrade,
} from "./subscription-lifecycle"

// Re-export webhook handlers
export { handleStripeWebhook, handleBTCPayWebhook } from "./webhook-handlers"

// Re-export payment records
export { createPaymentRecord } from "./payment-records"
export type { CreatePaymentRecordData } from "./payment-records"

// ── Legacy singleton ────────────────────────────────────────────────
// Existing consumers import `subscriptionService` and call methods on it.
// This thin wrapper delegates every method to the extracted modules so
// nothing breaks.

import {
  createSubscription,
  updateSubscription,
  updateSubscriptionStatus,
  cancelSubscription,
  getUserSubscription,
  hasActiveSubscription,
  updateUserTier,
  getSubscriptionsByProvider,
  getSubscriptionByProviderSubscriptionId,
  handlePaymentFailure,
  scheduleDowngrade,
  cancelScheduledDowngrade,
  executeScheduledDowngrade,
} from "./subscription-lifecycle"

import { getTierByName } from "./tier-service"
import { handleStripeWebhook, handleBTCPayWebhook } from "./webhook-handlers"
import { createPaymentRecord } from "./payment-records"

import type {
  CreateSubscriptionData,
  UpdateSubscriptionData,
  SubscriptionProvider,
  SubscriptionStatus,
  SubscriptionTier,
} from "./subscription-service.types"

class SubscriptionService {
  createSubscription(data: CreateSubscriptionData) {
    return createSubscription(data)
  }

  updateSubscription(userId: string, data: UpdateSubscriptionData) {
    return updateSubscription(userId, data)
  }

  updateSubscriptionStatus(userId: string, status: SubscriptionStatus) {
    return updateSubscriptionStatus(userId, status)
  }

  cancelSubscription(userId: string, immediate: boolean = false) {
    return cancelSubscription(userId, immediate)
  }

  getUserSubscription(userId: string) {
    return getUserSubscription(userId)
  }

  hasActiveSubscription(userId: string) {
    return hasActiveSubscription(userId)
  }

  updateUserTier(userId: string, tierName: SubscriptionTier) {
    return updateUserTier(userId, tierName)
  }

  getTierByName(tierName: SubscriptionTier) {
    return getTierByName(tierName)
  }

  getSubscriptionsByProvider(provider: SubscriptionProvider) {
    return getSubscriptionsByProvider(provider)
  }

  getSubscriptionByProviderSubscriptionId(
    provider: SubscriptionProvider,
    providerSubscriptionId: string,
  ) {
    return getSubscriptionByProviderSubscriptionId(provider, providerSubscriptionId)
  }

  handlePaymentFailure(userId: string, attemptCount: number = 1) {
    return handlePaymentFailure(userId, attemptCount)
  }

  handleStripeWebhook(event: any, userId: string) {
    return handleStripeWebhook(event, userId)
  }

  handleBTCPayWebhook(event: any, userId: string) {
    return handleBTCPayWebhook(event, userId)
  }

  createPaymentRecord(data: Parameters<typeof createPaymentRecord>[0]) {
    return createPaymentRecord(data)
  }

  scheduleDowngrade(userId: string) {
    return scheduleDowngrade(userId)
  }

  cancelScheduledDowngrade(userId: string) {
    return cancelScheduledDowngrade(userId)
  }

  executeScheduledDowngrade(userId: string) {
    return executeScheduledDowngrade(userId)
  }
}

export const subscriptionService = new SubscriptionService()
