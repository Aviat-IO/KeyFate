import { SubscriptionTier, TierConfig } from "../types/subscription";

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
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
      "No message templates",
      "Community support",
    ],
    price: {
      monthly: 0,
      annual: 0,
    },
    priceIds: {
      monthly: "pri_free_monthly", // Placeholder - will be updated with actual Paddle price IDs
      annual: "pri_free_annual",
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
      "Very flexible check-in intervals: 1 day, 3 days, 7 days, 2 weeks, 1 month, 3 months, 6 months, 12 months, 3 years",
      "Message templates",
      "Email support",
    ],
    price: {
      monthly: 9.00,
      annual: 90.00,
    },
    priceIds: {
      monthly: "pri_pro_monthly", // Placeholder
      annual: "pri_pro_annual",
    },
    featured: true,
  },
};

export const TIER_ORDER: SubscriptionTier[] = ["free", "pro"];

export const DEFAULT_TIER: SubscriptionTier = "free";

// Helper functions
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return TIER_CONFIGS[tier];
}

export function getTierByPriceId(priceId: string): SubscriptionTier | null {
  for (const [tierName, config] of Object.entries(TIER_CONFIGS)) {
    if (
      config.priceIds.monthly === priceId || config.priceIds.annual === priceId
    ) {
      return tierName as SubscriptionTier;
    }
  }
  return null;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function getAnnualSavings(tier: SubscriptionTier): number {
  const config = getTierConfig(tier);
  const monthlyTotal = config.price.monthly * 12;
  const annualPrice = config.price.annual;
  return monthlyTotal - annualPrice;
}

export function getAnnualSavingsPercentage(tier: SubscriptionTier): number {
  const config = getTierConfig(tier);
  const monthlyTotal = config.price.monthly * 12;
  const savings = getAnnualSavings(tier);
  return Math.round((savings / monthlyTotal) * 100);
}
