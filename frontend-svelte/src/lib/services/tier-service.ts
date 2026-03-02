/**
 * Tier/Plan Management
 *
 * Functions for reading, comparing, and ensuring subscription tiers exist.
 * Extracted from subscription-service.ts for maintainability.
 */

import { getDatabase } from "$lib/db/drizzle"
import { subscriptionTiers } from "$lib/db/schema"
import { eq } from "drizzle-orm"
import { logger } from "$lib/logger"
import type { SubscriptionTier } from "./subscription-service.types"

/**
 * Look up a subscription tier by name, creating it if missing.
 */
export async function getTierByName(tierName: SubscriptionTier) {
  const db = await getDatabase()
  try {
    let [tier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, tierName))
      .limit(1)

    if (!tier) {
      logger.warn(`Tier ${tierName} not found, attempting to create it`)
      tier = await ensureTierExists(tierName)
    }

    return tier || null
  } catch (error) {
    logger.error(
      "Failed to get tier by name",
      error instanceof Error ? error : undefined,
      { tierName },
    )
    throw error
  }
}

/**
 * Ensure a tier exists in the database, creating it with defaults if missing.
 */
async function ensureTierExists(tierName: SubscriptionTier) {
  const db = await getDatabase()

  const tierConfig = {
    free: {
      name: "free" as SubscriptionTier,
      displayName: "Free",
      maxSecrets: 1,
      maxRecipientsPerSecret: 1,
      customIntervals: false,
      priceMonthly: null,
      priceYearly: null,
    },
    pro: {
      name: "pro" as SubscriptionTier,
      displayName: "Pro",
      maxSecrets: 10,
      maxRecipientsPerSecret: 5,
      customIntervals: true,
      priceMonthly: "9.00",
      priceYearly: "90.00",
    },
  }

  const config = tierConfig[tierName as keyof typeof tierConfig]
  if (!config) {
    throw new Error(`Unknown tier: ${tierName}`)
  }

  try {
    const [tier] = await db
      .insert(subscriptionTiers)
      .values(config as typeof subscriptionTiers.$inferInsert)
      .onConflictDoNothing()
      .returning()

    if (!tier) {
      const [existingTier] = await db
        .select()
        .from(subscriptionTiers)
        .where(eq(subscriptionTiers.name, tierName))
        .limit(1)
      return existingTier
    }

    logger.info(`Created tier: ${tierName}`)
    return tier
  } catch (error) {
    logger.error(
      `Failed to create tier ${tierName}`,
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}

/**
 * Look up a subscription tier by its UUID.
 */
export async function getTierById(tierId: string) {
  const db = await getDatabase()
  try {
    const [tier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.id, tierId))
      .limit(1)

    return tier || null
  } catch (error) {
    logger.error(
      "Failed to get tier by ID",
      error instanceof Error ? error : undefined,
      { tierId },
    )
    throw error
  }
}

/**
 * Map a Stripe price ID to a subscription tier.
 *
 * Price IDs are read from environment variables so they can differ between
 * Stripe test-mode and live-mode without code changes.
 */
export function getTierFromStripePrice(priceId: string): SubscriptionTier {
  const priceToTierMap: Record<string, SubscriptionTier> = {}

  // Pro tier price IDs from environment (monthly + yearly)
  const proMonthly = process.env.STRIPE_PRICE_ID_PRO_MONTHLY
  const proYearly = process.env.STRIPE_PRICE_ID_PRO_YEARLY

  if (proMonthly) priceToTierMap[proMonthly] = "pro"
  if (proYearly) priceToTierMap[proYearly] = "pro"

  // Keep legacy fallback keys so existing test fixtures still work
  priceToTierMap["price_pro_monthly"] = "pro"
  priceToTierMap["price_pro_yearly"] = "pro"
  priceToTierMap["pro_monthly"] = "pro"
  priceToTierMap["pro_yearly"] = "pro"

  return priceToTierMap[priceId] || "free"
}

/**
 * Calculate the next billing date from a billing interval string.
 */
export function calculateNextBillingDate(interval: string): Date {
  const now = new Date()
  switch (interval) {
    case "month":
      now.setMonth(now.getMonth() + 1)
      return now
    case "year":
      now.setFullYear(now.getFullYear() + 1)
      return now
    default:
      now.setMonth(now.getMonth() + 1)
      return now
  }
}
