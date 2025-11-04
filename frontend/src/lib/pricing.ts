/**
 * Pricing configuration for different environments
 * Development and staging use cheaper test prices to facilitate testing
 *
 * Note: Test prices must be high enough to meet BTCPay Server minimum invoice
 * requirements (~1000 sats minimum for Lightning Network, ~$2 at current rates)
 */

export interface PricingTier {
  monthly: number
  yearly: number
}

const PRODUCTION_PRICES: PricingTier = {
  monthly: 9, // $9.00
  yearly: 90, // $90.00
}

const TEST_PRICES: PricingTier = {
  monthly: 2, // $2.00 (~2,000 sats - above BTCPay minimum)
  yearly: 5, // $5.00 (~5,000 sats - above BTCPay minimum)
}

/**
 * Determine if we're in production based on environment
 * This function is called on every invocation to allow for testing
 */
function isProduction(): boolean {
  if (typeof window !== "undefined") {
    // Client-side check
    return (
      window.location.hostname === "keyfate.com" ||
      window.location.hostname === "www.keyfate.com"
    )
  }
  // Server-side check
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  return (
    siteUrl.includes("keyfate.com") &&
    !siteUrl.includes("staging") &&
    !siteUrl.includes("dev")
  )
}

/**
 * Get pricing amounts based on environment
 * Returns test prices for dev/staging, production prices for production
 */
export function getPricing(): PricingTier {
  return isProduction() ? PRODUCTION_PRICES : TEST_PRICES
}

/**
 * Get the amount for a specific billing period
 */
export function getAmount(period: "monthly" | "yearly"): number {
  const pricing = getPricing()
  return pricing[period]
}

/**
 * Check if we're using test pricing
 */
export function isTestPricing(): boolean {
  return !isProduction()
}
