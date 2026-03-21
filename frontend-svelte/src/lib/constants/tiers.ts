import type { SubscriptionTier, TierConfig } from "$lib/types/subscription"

export const TIER_CONFIGS: Partial<Record<SubscriptionTier, TierConfig>> = {
  free: {
    name: "Free",
    id: "free",
    displayName: "Free",
    description: "Perfect for getting started with basic secret management",
    maxSecrets: 1,
    maxRecipientsPerSecret: 1,
    customIntervals: false,
    features: [
      "1 secret",
      "1 recipient per secret",
      "Available intervals: 1 week, 1 month, 1 year",
      "Standard 2-of-3 security (fixed)",
      "Community support",
    ],
    price: {
      monthly: 0,
      annual: 0,
    },
    priceIds: {
      monthly: "free",
      annual: "free",
    },
    featured: false,
  },
  pro: {
    name: "Pro",
    id: "pro",
    displayName: "Pro",
    description:
      "For power users who need maximum capacity and premium features",
    maxSecrets: 10,
    maxRecipientsPerSecret: 5,
    customIntervals: true,
    features: [
      "Up to 10 secrets",
      "Up to 5 recipients per secret",
      "Flexible check-in intervals: 1 day to 3 years",
      "Configurable security (2-of-N up to 7 shares)",
      "Message templates for common scenarios",
      "Comprehensive audit logs",
      "Priority email support (support@keyfate.com)",
    ],
    price: {
      monthly: 9.0,
      annual: 90.0,
    },
    priceInCents: {
      monthly: 900,
      annual: 9000,
    },
    priceIds: {
      monthly: "pro_monthly",
      annual: "pro_yearly",
    },
    featured: true,
  },
}

// Stripe lookup keys for easy reference
export const STRIPE_LOOKUP_KEYS = {
  PRO_MONTHLY: "pro_monthly",
  PRO_YEARLY: "pro_yearly",
} as const

export const TIER_ORDER: SubscriptionTier[] = ["free", "pro"]

export const DEFAULT_TIER: SubscriptionTier = "free"

// Helper functions
export function getTierConfig(tier: SubscriptionTier): TierConfig | undefined {
  return TIER_CONFIGS[tier]
}

export function getTierByPriceId(priceId: string): SubscriptionTier | null {
  for (const [tierName, config] of Object.entries(TIER_CONFIGS)) {
    if (
      config?.priceIds.monthly === priceId ||
      config?.priceIds.annual === priceId
    ) {
      return tierName as SubscriptionTier
    }
  }
  return null
}

// New helper to get lookup key by tier and billing period
export function getLookupKey(
  tier: SubscriptionTier,
  period: "monthly" | "annual",
): string | null {
  if (tier === "free") return null
  const tierConfig = TIER_CONFIGS[tier]
  return tierConfig?.priceIds[period] ?? null
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price)
}

export function getAnnualSavings(tier: SubscriptionTier): number {
  const config = getTierConfig(tier)
  if (!config) return 0
  const monthlyTotal = config.price.monthly * 12
  const annualPrice = config.price.annual
  return monthlyTotal - annualPrice
}

export function getAnnualSavingsPercentage(tier: SubscriptionTier): number {
  const config = getTierConfig(tier)
  if (!config) return 0
  const monthlyTotal = config.price.monthly * 12
  const savings = getAnnualSavings(tier)
  return Math.round((savings / monthlyTotal) * 100)
}

// Helper to get price in cents for payment processing
export function getPriceInCents(
  tier: SubscriptionTier,
  period: "monthly" | "annual",
): number {
  const config = getTierConfig(tier)
  if (!config || !config.priceInCents) return 0
  return config.priceInCents[period]
}
