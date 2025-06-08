"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Star, Zap } from "lucide-react"
import { SubscriptionTier } from "@/types/subscription"
import { TIER_CONFIGS } from "@/constants/tiers"
import {
  openSubscriptionCheckout,
  PRICING,
  setupPaddleEventListeners,
} from "@/lib/paddle"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User } from "@supabase/supabase-js"
import Link from "next/link"

interface PricingPageProps {
  currentTier?: SubscriptionTier
  showCurrentPlan?: boolean
  className?: string
}

export function PricingPage({
  currentTier = "free",
  showCurrentPlan = true,
  className = "",
}: PricingPageProps) {
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  )

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase.auth])

  useEffect(() => {
    // Setup Paddle event listeners for checkout completion
    setupPaddleEventListeners()
  }, [])

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!user?.email || !user?.id || tier === "free") return

    setLoading(tier)
    try {
      await openSubscriptionCheckout(tier, billingPeriod, {
        email: user.email,
        userId: user.id,
      })
    } catch (error) {
      console.error("Failed to open checkout:", error)
    } finally {
      setLoading(null)
    }
  }

  const isCurrentPlan = (tier: SubscriptionTier) => {
    return showCurrentPlan && currentTier === tier
  }

  const getButtonText = (tier: SubscriptionTier) => {
    if (loading === tier) return "Loading..."
    if (isCurrentPlan(tier)) return "Current Plan"
    if (tier === "free") return "Get Started"
    return "Upgrade to Pro"
  }

  const getButtonVariant = (tier: SubscriptionTier) => {
    if (isCurrentPlan(tier)) return "outline" as const
    if (tier === "pro") return "default" as const
    return "outline" as const
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-gray-300">
          Secure your digital legacy with KeyFate's dead man's switch service.
          Start free and upgrade when you need more capacity.
        </p>
      </div>

      {/* Billing Period Toggle */}
      <div className="flex justify-center">
        <div className="rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingPeriod === "monthly"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingPeriod === "yearly"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            Yearly
            <Badge className="ml-2 bg-green-100 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
              Save 17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        {/* Free Tier */}
        <Card
          className={`relative ${isCurrentPlan("free") ? "ring-2 ring-blue-500" : ""}`}
        >
          {isCurrentPlan("free") && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-blue-500 text-white">
              Current Plan
            </Badge>
          )}

          <CardHeader className="pb-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <Zap className="h-6 w-6 text-blue-500" />
              <CardTitle className="text-2xl">Free</CardTitle>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold">$0</div>
              <p className="text-gray-600 dark:text-gray-300">
                Perfect for getting started
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {TIER_CONFIGS.free.features.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleUpgrade("free")}
              disabled={loading === "free" || isCurrentPlan("free")}
              variant={getButtonVariant("free")}
              className="w-full"
            >
              {getButtonText("free")}
            </Button>
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card
          className={`relative ${isCurrentPlan("pro") ? "ring-2 ring-blue-500" : "ring-2 ring-purple-500"}`}
        >
          {isCurrentPlan("pro") ? (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-blue-500 text-white">
              Current Plan
            </Badge>
          ) : (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-purple-500 text-white">
              <Star className="mr-1 h-3 w-3" />
              Most Popular
            </Badge>
          )}

          <CardHeader className="pb-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <Crown className="h-6 w-6 text-purple-500" />
              <CardTitle className="text-2xl">Pro</CardTitle>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold">
                {billingPeriod === "monthly"
                  ? PRICING.pro.monthly.displayPrice
                  : PRICING.pro.yearly.displayPrice}
              </div>
              {billingPeriod === "yearly" && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-600">
                    {PRICING.pro.yearly.savings}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Equivalent to {PRICING.pro.yearly.monthlyEquivalent}
                  </p>
                </div>
              )}
              <p className="text-gray-600 dark:text-gray-300">
                For power users
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {TIER_CONFIGS.pro.features.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleUpgrade("pro")}
              disabled={loading === "pro" || isCurrentPlan("pro")}
              variant={getButtonVariant("pro")}
              className="w-full"
            >
              {getButtonText("pro")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="mx-auto max-w-3xl space-y-8">
        <h2 className="text-center text-2xl font-bold">
          Frequently Asked Questions
        </h2>

        <div className="grid gap-6">
          <div className="space-y-2">
            <h3 className="font-semibold">
              What happens if I exceed my plan limits?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You'll be prompted to upgrade when you reach your limits. Your
              existing secrets will continue to work, but you won't be able to
              create new ones until you upgrade or remove some existing secrets.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Can I change my plan anytime?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Yes! You can upgrade or downgrade your plan at any time. Changes
              take effect immediately, and billing is prorated accordingly.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">
              What payment methods do you accept?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              We accept all major credit cards, PayPal, and bank transfers
              through our secure payment processor Paddle.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Is my data secure?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Absolutely. Your secrets are encrypted using Shamir's Secret
              Sharing entirely in your browser. We never have access to your
              original secrets - only encrypted shares that cannot be used
              alone.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Can I cancel anytime?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Yes, you can cancel your subscription at any time. Your plan will
              remain active until the end of your billing period, then
              automatically downgrade to the free plan. We also offer a 30-day
              money-back guarantee.{" "}
              <Link href="/refunds" className="text-blue-600 hover:underline">
                See our refund policy
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="space-y-4 border-t pt-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Trusted by thousands of users worldwide
        </p>
        <div className="flex items-center justify-center space-x-8 text-gray-400 dark:text-gray-500">
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
