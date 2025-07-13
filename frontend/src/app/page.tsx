"use client"

import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { PricingCard } from "@/components/subscription/PricingCard"
import { BillingToggle } from "@/components/subscription/BillingToggle"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TIER_CONFIGS } from "@/constants/tiers"
import { Clock, Lock, Shield } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function Home() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "yearly",
  )

  // Static pricing data
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

  return (
    <div className="bg-background min-h-screen">
      <NavBar />

      {/* Hero Section */}
      <section className="container relative mx-auto overflow-hidden px-4 py-24">
        {/* Content */}
        <div className="relative z-10 text-center">
          <h1 className="text-foreground text-4xl font-bold tracking-tight drop-shadow-lg sm:text-6xl">
            KeyFate
          </h1>
          <p className="text-muted-foreground mt-6 text-lg leading-8 drop-shadow-md">
            Your key to peace of mind. Share your secrets with trusted contacts
            if you don't check in
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" asChild>
              <Link href="/auth/signup">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Shield className="text-primary mb-4 h-12 w-12" />
              <CardTitle>Secure Storage</CardTitle>
              <CardDescription>
                Your secrets are encrypted and stored securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              Shamir's Secret Sharing happens 100% client-side. We only store
              one encrypted share that alone cannot reconstruct your secret.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="text-primary mb-4 h-12 w-12" />
              <CardTitle>Flexible Check-ins</CardTitle>
              <CardDescription>Set your own schedule</CardDescription>
            </CardHeader>
            <CardContent>
              Choose how often you need to check in. Get reminders when it's
              time.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Lock className="text-primary mb-4 h-12 w-12" />
              <CardTitle>Trusted Contacts</CardTitle>
              <CardDescription>
                Choose who receives your information
              </CardDescription>
            </CardHeader>
            <CardContent>
              Select trusted contacts to receive your secrets if you don't check
              in.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto border-t px-4 py-24">
        <div className="space-y-8">
          <div className="space-y-4 text-center">
            <h2 className="text-4xl font-bold tracking-tight">
              Simple Pricing
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
              Secure your digital legacy with KeyFate's dead man's switch
              service. Start free and upgrade when you need more capacity.
            </p>
          </div>

          <BillingToggle
            billingPeriod={billingPeriod}
            onPeriodChange={setBillingPeriod}
          />

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
              buttonHref="/auth/signup"
              isPopular={true}
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
