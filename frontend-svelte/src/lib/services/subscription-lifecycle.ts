/**
 * Subscription Lifecycle Management
 *
 * Core CRUD operations for subscriptions: create, update, cancel,
 * query, downgrade scheduling, and payment failure handling.
 * Extracted from subscription-service.ts for maintainability.
 */

import { getDatabase } from "$lib/db/drizzle"
import { userSubscriptions } from "$lib/db/schema"
import { logSubscriptionChanged } from "$lib/services/audit-logger"
import { and, eq } from "drizzle-orm"
import { logger } from "$lib/logger"
import { getPriceInCents } from "$lib/constants/tiers"
import { getTierByName, getTierById } from "./tier-service"
import type {
  SubscriptionProvider,
  SubscriptionStatus,
  SubscriptionTier,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from "./subscription-service.types"

// Lazy import to avoid circular deps at module level
async function getEmailService() {
  const { emailService } = await import("$lib/email/email-service")
  return emailService
}

/**
 * Create a new subscription record.
 */
export async function createSubscription(data: CreateSubscriptionData) {
  const db = await getDatabase()
  try {
    const tier = await getTierByName(data.tierName)
    if (!tier) {
      throw new Error(`Tier ${data.tierName} not found`)
    }

    const insertValues: typeof userSubscriptions.$inferInsert = {
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
    }

    const [subscription] = await db
      .insert(userSubscriptions)
      .values(insertValues)
      .returning()

    await logSubscriptionChanged(data.userId, {
      action: "created",
      tier: data.tierName,
      provider: data.provider,
      status: data.status,
      resourceType: "subscription",
      resourceId: `${data.provider}:${data.tierName}`,
    })

    // Send confirmation email (don't await to avoid blocking)
    sendSubscriptionConfirmationEmail(data.userId, {
      provider: data.provider,
      tierName: data.tierName,
      status: data.status,
    }).catch((error) => {
      logger.error(
        "Failed to send subscription confirmation email",
        error instanceof Error ? error : undefined,
      )
    })

    return subscription
  } catch (error) {
    logger.error(
      "Failed to create subscription",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Update an existing subscription.
 */
export async function updateSubscription(
  userId: string,
  data: UpdateSubscriptionData,
) {
  const db = await getDatabase()
  try {
    const [currentSub] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1)

    let tierId: string | undefined
    if (data.tierName) {
      const tier = await getTierByName(data.tierName)
      if (!tier) {
        throw new Error(`Tier ${data.tierName} not found`)
      }
      tierId = tier.id
    }

    const { tierName: _tierName, ...restData } = data
    const updateData: Partial<typeof userSubscriptions.$inferInsert> = {
      ...restData,
      updatedAt: new Date(),
    }

    if (tierId) {
      updateData.tierId = tierId
    }

    const [subscription] = await db
      .update(userSubscriptions)
      .set(updateData)
      .where(eq(userSubscriptions.userId, userId))
      .returning()

    await logSubscriptionChanged(userId, {
      action: "updated",
      ...data,
      resourceType: "subscription",
      resourceId: data.tierName
        ? `${currentSub?.provider || "unknown"}:${data.tierName}`
        : undefined,
    })

    return subscription
  } catch (error) {
    logger.error(
      "Failed to update subscription",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Update only the subscription status.
 */
export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
) {
  return updateSubscription(userId, { status })
}

/**
 * Cancel a subscription, either immediately or at period end.
 */
export async function cancelSubscription(
  userId: string,
  immediate: boolean = false,
) {
  try {
    const updateData: UpdateSubscriptionData = immediate
      ? { status: "cancelled", cancelAtPeriodEnd: false }
      : { cancelAtPeriodEnd: true }

    const subscription = await updateSubscription(userId, updateData)

    // Send cancellation email (don't await to avoid blocking)
    sendCancellationEmail(userId).catch((error) => {
      logger.error(
        "Failed to send cancellation email",
        error instanceof Error ? error : undefined,
      )
    })

    return subscription
  } catch (error) {
    logger.error(
      "Failed to cancel subscription",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Get the subscription for a user, or null if none exists.
 */
export async function getUserSubscription(userId: string) {
  const db = await getDatabase()
  try {
    const subscription = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1)

    return subscription[0] || null
  } catch (error) {
    logger.error(
      "Failed to get user subscription",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Check whether a user has an active subscription.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const db = await getDatabase()
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
      .limit(1)

    return subscription.length > 0
  } catch (error) {
    logger.error(
      "Failed to check active subscription",
      error instanceof Error ? error : undefined,
    )
    return false
  }
}

/**
 * Update a user's subscription tier.
 */
export async function updateUserTier(
  userId: string,
  tierName: SubscriptionTier,
) {
  try {
    const tier = await getTierByName(tierName)
    if (!tier) {
      throw new Error(`Tier ${tierName} not found`)
    }

    await updateSubscription(userId, { tierName })
    return tier
  } catch (error) {
    logger.error(
      "Failed to update user tier",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Get all subscriptions for a given provider.
 */
export async function getSubscriptionsByProvider(
  provider: SubscriptionProvider,
) {
  const db = await getDatabase()
  try {
    return await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.provider, provider))
  } catch (error) {
    logger.error(
      "Failed to get subscriptions by provider",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Look up a subscription by its provider-side subscription ID.
 */
export async function getSubscriptionByProviderSubscriptionId(
  provider: SubscriptionProvider,
  providerSubscriptionId: string,
) {
  const db = await getDatabase()
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
      .limit(1)

    return subscription || null
  } catch (error) {
    logger.error(
      "Failed to get subscription by provider subscription ID",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Handle a payment failure: update status, notify user, cancel after 3 failures.
 */
export async function handlePaymentFailure(
  userId: string,
  attemptCount: number = 1,
) {
  try {
    const subscription = await getUserSubscription(userId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    if (attemptCount === 1) {
      await updateSubscriptionStatus(userId, "past_due")
    }

    const tier = await getTierById(subscription.tierId)
    const tierName: SubscriptionTier = tier?.name ?? "pro"
    const amountInCents = getPriceInCents(tierName, "monthly")

    const emailService = await getEmailService()
    emailService
      .sendPaymentFailedNotification(userId, {
        provider: subscription.provider as SubscriptionProvider,
        subscriptionId: subscription.providerSubscriptionId || "",
        amount: amountInCents,
        attemptCount,
        nextRetry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .catch((error: unknown) => {
        logger.error(
          "Failed to send payment failure notification",
          error instanceof Error ? error : undefined,
        )
      })

    if (attemptCount >= 3) {
      await cancelSubscription(userId, true)
    }

    return subscription
  } catch (error) {
    logger.error(
      "Failed to handle payment failure",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Schedule a downgrade to free tier at the end of the current billing period.
 */
export async function scheduleDowngrade(userId: string) {
  const db = await getDatabase()
  try {
    const subscription = await getUserSubscription(userId)

    if (!subscription) {
      throw new Error("No active subscription found")
    }

    if (subscription.status === "cancelled") {
      throw new Error("Cannot schedule downgrade for cancelled subscription")
    }

    if (subscription.scheduledDowngradeAt) {
      return subscription
    }

    if (!subscription.currentPeriodEnd) {
      throw new Error(
        "Cannot schedule downgrade: currentPeriodEnd is missing",
      )
    }

    const scheduledDowngradeAt = new Date(subscription.currentPeriodEnd)

    const setDowngrade: Partial<typeof userSubscriptions.$inferInsert> = {
      scheduledDowngradeAt,
      updatedAt: new Date(),
    }
    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set(setDowngrade)
      .where(eq(userSubscriptions.userId, userId))
      .returning()

    if (
      subscription.provider === "stripe" &&
      subscription.providerSubscriptionId
    ) {
      const { getFiatPaymentProvider } = await import("$lib/payment")
      const stripeProvider = getFiatPaymentProvider()
      if (stripeProvider.updateSubscription) {
        await stripeProvider.updateSubscription(
          subscription.providerSubscriptionId,
          {
            cancelAtPeriodEnd: true,
          },
        )
      }
    }

    await logSubscriptionChanged(userId, {
      action: "downgrade_scheduled",
      scheduledFor: scheduledDowngradeAt,
      resourceType: "subscription",
      resourceId: `downgrade:free`,
    })

    return updatedSubscription
  } catch (error) {
    logger.error(
      "Failed to schedule downgrade",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Cancel a previously scheduled downgrade.
 */
export async function cancelScheduledDowngrade(userId: string) {
  const db = await getDatabase()
  try {
    const subscription = await getUserSubscription(userId)

    if (!subscription) {
      throw new Error("No subscription found")
    }

    if (!subscription.scheduledDowngradeAt) {
      throw new Error("No scheduled downgrade found")
    }

    const setCancelDowngrade: Partial<typeof userSubscriptions.$inferInsert> = {
      scheduledDowngradeAt: null,
      updatedAt: new Date(),
    }
    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set(setCancelDowngrade)
      .where(eq(userSubscriptions.userId, userId))
      .returning()

    if (
      subscription.provider === "stripe" &&
      subscription.providerSubscriptionId
    ) {
      const { getFiatPaymentProvider } = await import("$lib/payment")
      const stripeProvider = getFiatPaymentProvider()
      if (stripeProvider.updateSubscription) {
        await stripeProvider.updateSubscription(
          subscription.providerSubscriptionId,
          {
            cancelAtPeriodEnd: false,
          },
        )
      }
    }

    await logSubscriptionChanged(userId, {
      action: "downgrade_cancelled",
      resourceType: "subscription",
      resourceId: "downgrade:cancelled",
    })

    return updatedSubscription
  } catch (error) {
    logger.error(
      "Failed to cancel scheduled downgrade",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Execute a scheduled downgrade — move user to the free tier.
 */
export async function executeScheduledDowngrade(userId: string) {
  const db = await getDatabase()
  try {
    const freeTier = await getTierByName("free")
    if (!freeTier) {
      throw new Error("Free tier not found")
    }

    const subscription = await getUserSubscription(userId)
    const oldTierName = subscription?.tierId || "unknown"

    const setExecuteDowngrade: Partial<typeof userSubscriptions.$inferInsert> = {
      tierId: freeTier.id,
      status: "cancelled",
      scheduledDowngradeAt: null,
      updatedAt: new Date(),
    }
    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set(setExecuteDowngrade)
      .where(eq(userSubscriptions.userId, userId))
      .returning()

    await logSubscriptionChanged(userId, {
      action: "downgrade_executed",
      from: oldTierName,
      to: "free",
      resourceType: "subscription",
      resourceId: `${oldTierName}:free`,
    })

    return updatedSubscription
  } catch (error) {
    logger.error(
      "Failed to execute scheduled downgrade",
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

// ── Private email helpers ──────────────────────────────────────────

async function sendSubscriptionConfirmationEmail(
  userId: string,
  subscriptionData: {
    provider: SubscriptionProvider
    tierName: SubscriptionTier
    status: SubscriptionStatus
  },
) {
  try {
    const amountInCents = getPriceInCents(
      subscriptionData.tierName,
      "monthly",
    )

    const emailService = await getEmailService()
    await emailService.sendSubscriptionConfirmation(userId, {
      provider: subscriptionData.provider,
      tierName: subscriptionData.tierName,
      amount: amountInCents,
      interval: "month",
    })
  } catch (error) {
    logger.error(
      "Failed to send subscription confirmation email",
      error instanceof Error ? error : undefined,
    )
    // Don't throw - email failures shouldn't break subscription creation
  }
}

async function sendCancellationEmail(userId: string) {
  try {
    const emailService = await getEmailService()
    await emailService.sendSubscriptionCancelledNotification(userId)
  } catch (error) {
    logger.error(
      "Failed to send cancellation email",
      error instanceof Error ? error : undefined,
    )
    // Don't throw - email failures shouldn't break cancellation
  }
}
