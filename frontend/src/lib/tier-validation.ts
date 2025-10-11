import { SubscriptionTier } from "@/types/subscription"

export function canAccessMessageTemplates(tier: SubscriptionTier): boolean {
  return tier === "pro"
}

export function canConfigureThreshold(tier: SubscriptionTier): boolean {
  return tier === "pro"
}

export function canAccessAuditLogs(tier: SubscriptionTier): boolean {
  return tier === "pro"
}

export function getMaxShares(tier: SubscriptionTier): number {
  return tier === "pro" ? 7 : 3
}

export function getMaxThreshold(tier: SubscriptionTier, totalShares: number): number {
  return Math.min(totalShares, getMaxShares(tier))
}

export function getMinThreshold(): number {
  return 2
}

export function isValidThreshold(
  tier: SubscriptionTier,
  threshold: number,
  totalShares: number
): boolean {
  const maxShares = getMaxShares(tier)
  const minThreshold = getMinThreshold()

  if (totalShares > maxShares) return false
  if (totalShares < 3) return false
  if (threshold < minThreshold) return false
  if (threshold > totalShares) return false

  return true
}
