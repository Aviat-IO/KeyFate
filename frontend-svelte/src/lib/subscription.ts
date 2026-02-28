import { eq, count, and, inArray } from "drizzle-orm"
import { getTierConfig } from "$lib/constants/tiers"
import type {
  SubscriptionTier,
  TierLimits,
  UserTierInfo,
} from "$lib/types/subscription"
import { getDatabase } from "./db/drizzle"
import {
  userSubscriptions,
  subscriptionTiers,
  secrets,
  secretRecipients,
} from "./db/schema"

export async function getUserTierInfo(
  userId: string,
): Promise<UserTierInfo | null> {
  try {
    const db = await getDatabase()

    const [subscription] = await db
      .select({
        id: userSubscriptions.id,
        userId: userSubscriptions.userId,
        tierId: userSubscriptions.tierId,
        provider: userSubscriptions.provider,
        providerCustomerId: userSubscriptions.providerCustomerId,
        providerSubscriptionId: userSubscriptions.providerSubscriptionId,
        status: userSubscriptions.status,
        currentPeriodStart: userSubscriptions.currentPeriodStart,
        currentPeriodEnd: userSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd,
        scheduledDowngradeAt: userSubscriptions.scheduledDowngradeAt,
        tier: {
          id: subscriptionTiers.id,
          name: subscriptionTiers.name,
          displayName: subscriptionTiers.displayName,
          maxSecrets: subscriptionTiers.maxSecrets,
          maxRecipientsPerSecret: subscriptionTiers.maxRecipientsPerSecret,
          customIntervals: subscriptionTiers.customIntervals,
          priceMonthly: subscriptionTiers.priceMonthly,
          priceYearly: subscriptionTiers.priceYearly,
        },
      })
      .from(userSubscriptions)
      .leftJoin(
        subscriptionTiers,
        eq(userSubscriptions.tierId, subscriptionTiers.id),
      )
      .where(eq(userSubscriptions.userId, userId))
      .limit(1)

    if (!subscription) {
      const freeTierConfig = getTierConfig("free")
      if (!freeTierConfig) {
        throw new Error("Free tier configuration not found")
      }

      const usage = await calculateUserUsage(userId)
      const canCreate = usage.secrets_count < freeTierConfig.maxSecrets

      return {
        tier: {
          tiers: {
            id: "free",
            name: "free" as SubscriptionTier,
            display_name: "Free",
            max_secrets: freeTierConfig.maxSecrets,
            max_recipients_per_secret: freeTierConfig.maxRecipientsPerSecret,
            custom_intervals: freeTierConfig.customIntervals,
            price_monthly: null,
            price_yearly: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        } as any,
        subscription: undefined,
        usage,
        limits: {
          secrets: {
            current: usage.secrets_count,
            max: freeTierConfig.maxSecrets,
            canCreate,
          },
          recipients: {
            current: usage.total_recipients,
            max: freeTierConfig.maxRecipientsPerSecret,
          },
        },
      }
    }

    const usage = await calculateUserUsage(userId)
    const maxSecrets = subscription.tier?.maxSecrets ?? 1
    const maxRecipients = subscription.tier?.maxRecipientsPerSecret ?? 1
    const canCreate = usage.secrets_count < maxSecrets

    return {
      tier: {
        tiers: {
          id: subscription.tier?.id ?? "free",
          name: (subscription.tier?.name ?? "free") as SubscriptionTier,
          display_name: subscription.tier?.displayName ?? "Free",
          max_secrets: maxSecrets,
          max_recipients_per_secret: maxRecipients,
          custom_intervals: subscription.tier?.customIntervals ?? false,
          price_monthly: subscription.tier?.priceMonthly
            ? parseFloat(subscription.tier.priceMonthly)
            : null,
          price_yearly: subscription.tier?.priceYearly
            ? parseFloat(subscription.tier.priceYearly)
            : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      } as any,
      subscription: subscription as any,
      usage,
      limits: {
        secrets: {
          current: usage.secrets_count,
          max: maxSecrets,
          canCreate,
        },
        recipients: {
          current: usage.total_recipients,
          max: maxRecipients,
        },
      },
    }
  } catch (error) {
    console.error("Error in getUserTierInfo:", error)
    return null
  }
}

export async function canUserCreateSecret(userId: string): Promise<boolean> {
  try {
    const tierInfo = await getUserTierInfo(userId)
    if (!tierInfo) {
      return false
    }
    return tierInfo.limits.secrets.canCreate
  } catch (error) {
    console.error("Error in canUserCreateSecret:", error)
    return false
  }
}

export async function calculateUserUsage(userId: string) {
  try {
    const db = await getDatabase()

    const [result] = await db
      .select({
        secrets_count: count(secrets.id),
      })
      .from(secrets)
      .where(
        and(
          eq(secrets.userId, userId),
          inArray(secrets.status, ["active", "paused"]),
        ),
      )

    const countableSecretsCount = result?.secrets_count ?? 0

    const countableSecretIds = await db
      .select({ id: secrets.id })
      .from(secrets)
      .where(
        and(
          eq(secrets.userId, userId),
          inArray(secrets.status, ["active", "paused"]),
        ),
      )

    if (countableSecretIds.length === 0) {
      return {
        secrets_count: 0,
        total_recipients: 0,
      }
    }

    const secretIdList = countableSecretIds.map((s) => s.id)

    if (secretIdList.length === 0) {
      return {
        secrets_count: 0,
        total_recipients: 0,
      }
    }

    const recipients = await db
      .select({
        email: secretRecipients.email,
      })
      .from(secretRecipients)
      .where(inArray(secretRecipients.secretId, secretIdList))

    const uniqueRecipients = new Set(
      recipients
        .map((r) => r.email)
        .filter((email): email is string => email !== null),
    )

    return {
      secrets_count: countableSecretsCount,
      total_recipients: uniqueRecipients.size,
    }
  } catch (error) {
    console.error("Error in calculateUserUsage:", error)
    return { secrets_count: 0, total_recipients: 0 }
  }
}

// Get tier limits for enforcement
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  const config = getTierConfig(tier)
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`)
  }
  return {
    maxSecrets: config.maxSecrets,
    maxRecipientsPerSecret: config.maxRecipientsPerSecret,
    customIntervals: config.customIntervals,
  }
}

// Check if an interval is allowed for a tier
export function isIntervalAllowed(
  tier: SubscriptionTier,
  intervalDays: number,
): boolean {
  const config = getTierConfig(tier)
  if (!config) {
    return false
  }

  if (config.customIntervals) {
    // Pro tier allows: 1 day, 3 days, 7 days, 2 weeks, 1 month, 3 months, 6 months, 12 months, 3 years
    const allowedDays = [1, 3, 7, 14, 30, 90, 180, 365, 1095]
    return allowedDays.includes(intervalDays)
  } else {
    // Free tier allows: 1 week, 1 month, 1 year
    const allowedDays = [7, 30, 365]
    return allowedDays.includes(intervalDays)
  }
}

// Get available intervals for a tier
export function getAvailableIntervals(
  tier: SubscriptionTier,
): Array<{ days: number; label: string }> {
  const config = getTierConfig(tier)
  if (!config) {
    return []
  }

  if (config.customIntervals) {
    // Pro tier intervals
    return [
      { days: 1, label: "1 day" },
      { days: 3, label: "3 days" },
      { days: 7, label: "1 week" },
      { days: 14, label: "2 weeks" },
      { days: 30, label: "1 month" },
      { days: 90, label: "3 months" },
      { days: 180, label: "6 months" },
      { days: 365, label: "1 year" },
      { days: 1095, label: "3 years" },
    ]
  } else {
    // Free tier intervals
    return [
      { days: 7, label: "1 week" },
      { days: 30, label: "1 month" },
      { days: 365, label: "1 year" },
    ]
  }
}

// Update user tier (typically called from webhook or admin functions)
export async function updateUserTier(
  userId: string,
  tierName: SubscriptionTier,
  subscriptionData?: {
    paddleSubscriptionId: string
    paddleCustomerId: string
    status: string
    currentPeriodStart?: string
    currentPeriodEnd?: string
  },
) {
  // Stubbed no-op for now
  await calculateUserUsage(userId)
  return true
}

// Initialize free tier for new users
export async function initializeUserTier(userId: string) {
  await calculateUserUsage(userId)
  return true
}
