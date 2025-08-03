"use client"

import { BillingToggle } from "@/components/subscription/BillingToggle"
import { PricingCard } from "@/components/subscription/PricingCard"
import { TIER_CONFIGS, getLookupKey } from "@/constants/tiers"
import { Check } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface StaticPricingPageProps {
  className?: string
}

export function StaticPricingPage({ className = "" }: StaticPricingPageProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "yearly",
  )

  // Static pricing without external dependency
  const STATIC_PRICING = {
    pro: {
      monthly: {
        price: "$9/month",
        subtext: undefined,
        savingsText: undefined,
      },
      yearly: {
        price: "$7.50/month",
        subtext: "Billed annually at $90/year",
        savingsText: "$18 saved (17% off)",
      },
    },
  }

  const proData = STATIC_PRICING.pro[billingPeriod]
  const proLookupKey = getLookupKey(
    "pro",
    billingPeriod === "monthly" ? "monthly" : "annual",
  )

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-foreground text-4xl font-bold tracking-tight">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          Secure your digital legacy with KeyFate's dead man's switch service.
          Start free and upgrade when you need more capacity.
        </p>
      </div>

      {/* Billing Period Toggle */}
      <BillingToggle
        billingPeriod={billingPeriod}
        onPeriodChange={setBillingPeriod}
      />

      {/* Pricing Cards */}
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <PricingCard
          title="Free"
          description="Perfect for getting started"
          price="$0"
          features={TIER_CONFIGS.free.features}
          buttonText="Get Started"
          buttonHref="/auth/signup"
        />

        <PricingCard
          title="Pro"
          description="For power users"
          price={proData.price}
          subtext={proData.subtext}
          savingsText={proData.savingsText}
          features={TIER_CONFIGS.pro.features}
          buttonText="Get Started with Pro"
          stripeLookupKey={proLookupKey || undefined}
          isPopular={true}
        />
      </div>

      {/* FAQ Section */}
      <div className="mx-auto max-w-3xl space-y-8 pt-16">
        <h2 className="text-foreground text-center text-2xl font-bold">
          Frequently Asked Questions
        </h2>

        <div className="grid gap-6">
          <div className="space-y-2">
            <h3 className="text-foreground font-semibold">
              What happens if I exceed my plan limits?
            </h3>
            <p className="text-muted-foreground text-sm">
              You'll be prompted to upgrade when you reach your limits. Your
              existing secrets will continue to work, but you won't be able to
              create new ones until you upgrade or remove some existing secrets.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-foreground font-semibold">
              Can I change my plan anytime?
            </h3>
            <p className="text-muted-foreground text-sm">
              Yes! You can upgrade or downgrade your plan at any time. Changes
              take effect immediately, and billing is prorated accordingly.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-foreground font-semibold">
              What payment methods do you accept?
            </h3>
            <p className="text-muted-foreground text-sm">
              We accept all major credit cards and other payment methods through
              our secure payment processor Stripe.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-foreground font-semibold">
              Can I cancel anytime?
            </h3>
            <p className="text-muted-foreground text-sm">
              Yes, you can cancel your subscription at any time. Your plan will
              remain active until the end of your billing period, then
              automatically downgrade to the free plan. We also offer a 30-day
              money-back guarantee.{" "}
              <Link href="/refunds" className="text-primary hover:underline">
                See our refund policy
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="space-y-4 border-t pt-8 text-center">
        <p className="text-muted-foreground text-sm">
          Trusted by thousands of users worldwide
        </p>
        <div className="text-muted-foreground flex items-center justify-center space-x-8">
          <div className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span className="text-xs">256-bit encryption</span>
          </div>
          <div className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span className="text-xs">SOC 2 compliant</span>
          </div>
          <div className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span className="text-xs">99.9% uptime</span>
          </div>
        </div>
      </div>
    </div>
  )
}
