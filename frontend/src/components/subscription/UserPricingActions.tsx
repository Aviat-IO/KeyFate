"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { STRIPE_LOOKUP_KEYS } from "@/constants/tiers"
import { createClient } from "@/utils/supabase/client"
import { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { BillingPortalButton } from "./BillingPortalButton"
import { StripeCheckoutButton } from "./StripeCheckoutButton"

const supabase = createClient()

export function UserPricingActions() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    loadUserData()
  }, [])

  if (loading) {
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

  if (!user) {
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

  // For now, show upgrade options for all authenticated users
  // TODO: Check actual subscription status once Stripe columns are available
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Your Account
          <Badge variant="secondary">Free Plan</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">Email: {user.email}</p>
        </div>

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
          <div className="pt-2">
            <BillingPortalButton />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
