"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { STRIPE_LOOKUP_KEYS } from "@/constants/tiers"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { BillingPortalButton } from "./BillingPortalButton"
import { StripeCheckoutButton } from "./StripeCheckoutButton"

interface UserTierInfo {
  tier: string
  displayName: string
  subscription?: {
    status: string
  } | null
}

export function UserPricingActions() {
  const { data: session, status } = useSession()
  const [tierInfo, setTierInfo] = useState<UserTierInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTierInfo() {
      if (session?.user && (session.user as any).id) {
        try {
          const response = await fetch("/api/user/tier")
          if (response.ok) {
            const data = await response.json()
            setTierInfo(data)
          }
        } catch (error) {
          console.error("Failed to fetch tier info:", error)
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }

    if (status !== "loading") {
      fetchTierInfo()
    }
  }, [session, status])

  if (status === "loading" || loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-4 w-3/4 rounded"></div>
            <div className="bg-muted h-10 w-full rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!session?.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Get Started</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Sign up for a free account to start using KeyFate.
          </p>
          <Button className="w-full" asChild>
            <a href="/auth/signup">Sign Up Free</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isProUser = tierInfo?.tier === "premium" || tierInfo?.tier === "pro"
  const displayName = tierInfo?.displayName || "Free"
  const subscriptionStatus = tierInfo?.subscription?.status

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Your Account
          <Badge variant={isProUser ? "default" : "secondary"}>
            {displayName} Plan
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">
            Email: {session.user.email}
          </p>
          {subscriptionStatus && (
            <p className="text-muted-foreground mt-1 text-sm">
              Status: <span className="capitalize">{subscriptionStatus}</span>
            </p>
          )}
        </div>

        {!isProUser && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Upgrade to Pro for more features:
            </p>
            <div className="space-y-2">
              <StripeCheckoutButton lookupKey={STRIPE_LOOKUP_KEYS.PRO_YEARLY}>
                Upgrade to Pro - Annual ($90/year)
              </StripeCheckoutButton>
              <StripeCheckoutButton lookupKey={STRIPE_LOOKUP_KEYS.PRO_MONTHLY}>
                Upgrade to Pro - Monthly ($9/month)
              </StripeCheckoutButton>
            </div>
          </div>
        )}

        <div className="pt-2">
          <BillingPortalButton />
        </div>
      </CardContent>
    </Card>
  )
}
