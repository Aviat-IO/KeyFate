"use client"

import { StaticPricingPage } from "./StaticPricingPage"

interface PricingPageProps {
  userTier?: string
  userTierDisplayName?: string
}

export function PricingPage({
  userTier,
  userTierDisplayName,
}: PricingPageProps) {
  return (
    <div>
      <StaticPricingPage
        userTier={userTier}
        userTierDisplayName={userTierDisplayName}
      />
    </div>
  )
}
