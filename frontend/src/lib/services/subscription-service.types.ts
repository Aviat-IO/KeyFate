/**
 * Shared types for subscription service modules.
 *
 * Extracted to avoid circular dependencies between
 * tier-service, webhook-handlers, subscription-lifecycle, and payment-records.
 */

import {
  subscriptionStatusEnum,
  subscriptionTierEnum,
} from "$lib/db/schema"

export type SubscriptionProvider = "stripe" | "btcpay"
export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number]
export type SubscriptionTier = (typeof subscriptionTierEnum.enumValues)[number]

export interface CreateSubscriptionData {
  userId: string
  provider: SubscriptionProvider
  providerCustomerId: string | null
  providerSubscriptionId: string
  tierName: SubscriptionTier
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd?: boolean
}

export interface UpdateSubscriptionData {
  tierName?: SubscriptionTier
  status?: SubscriptionStatus
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
}
