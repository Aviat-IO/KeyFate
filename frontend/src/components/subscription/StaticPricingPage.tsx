"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Star, Zap } from "lucide-react"
import { TIER_CONFIGS } from "@/constants/tiers"
import Link from "next/link"

interface StaticPricingPageProps {
  className?: string
}

export function StaticPricingPage({ className = "" }: StaticPricingPageProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  )

  // Static pricing without Paddle dependency
  const STATIC_PRICING = {
    pro: {
      monthly: {
        amount: 9.0,
        displayPrice: "$9/month",
      },
      yearly: {
        amount: 90.0,
        displayPrice: "$90/year",
        savings: "$18 saved (17% off)",
        monthlyEquivalent: "$7.50/month",
      },
    },
  }

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
      <div className="flex justify-center">
        <div className="bg-muted rounded-lg p-1">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingPeriod === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingPeriod === "yearly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <Badge className="bg-success text-success-foreground ml-2 text-xs">
              Save 17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        {/* Free Tier */}
        <Card>
          <CardHeader className="pb-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <Zap className="text-primary h-6 w-6" />
              <CardTitle className="text-2xl">Free</CardTitle>
            </div>
            <div className="space-y-2">
              <div className="text-foreground text-4xl font-bold">$0</div>
              <p className="text-muted-foreground">
                Perfect for getting started
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {TIER_CONFIGS.free.features.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-foreground text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full" asChild>
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card className="border-primary">
          <CardHeader className="pb-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <Crown className="text-primary h-6 w-6" />
              <CardTitle className="text-2xl">Pro</CardTitle>
            </div>
            <div className="space-y-2">
              <div className="text-foreground text-4xl font-bold">
                {billingPeriod === "monthly"
                  ? STATIC_PRICING.pro.monthly.displayPrice
                  : STATIC_PRICING.pro.yearly.displayPrice}
              </div>
              {billingPeriod === "yearly" && (
                <div className="space-y-1">
                  <p className="text-success text-sm font-medium">
                    {STATIC_PRICING.pro.yearly.savings}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Equivalent to {STATIC_PRICING.pro.yearly.monthlyEquivalent}
                  </p>
                </div>
              )}
              <p className="text-muted-foreground">For power users</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {TIER_CONFIGS.pro.features.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-foreground text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full" asChild>
              <Link href="/auth/signup">Get Started with Pro</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="mx-auto max-w-3xl space-y-8">
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
              We accept all major credit cards, PayPal, and bank transfers
              through our secure payment processor Paddle.
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
