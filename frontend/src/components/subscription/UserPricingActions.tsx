"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Crown, AlertCircle } from "lucide-react"
import { SubscriptionTier } from "@/types/subscription"
import { getUserTierInfo } from "@/lib/subscription-utils"
import {
  openSubscriptionCheckout,
  setupPaddleEventListeners,
} from "@/lib/paddle-placeholder"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User } from "@supabase/supabase-js"

interface UserPricingActionsProps {
  className?: string
}

export function UserPricingActions({
  className = "",
}: UserPricingActionsProps) {
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>("free")
  const [loading, setLoading] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user?.id) {
        try {
          const tierInfo = await getUserTierInfo(user.id)
          setCurrentTier(tierInfo?.subscription ? "pro" : "free")
        } catch (error) {
          console.error("Error getting user tier:", error)
          setError("Failed to load subscription status")
        }
      }
    }
    getUser()
  }, [supabase.auth])

  useEffect(() => {
    // Setup Paddle event listeners for checkout completion
    try {
      setupPaddleEventListeners()
    } catch (error) {
      console.error("Failed to setup Paddle:", error)
      setError("Payment system unavailable")
    }
  }, [])

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!user?.email || !user?.id || tier === "free") return

    setLoading(tier)
    setError(null)

    try {
      await openSubscriptionCheckout(tier, billingPeriod, {
        email: user.email,
        userId: user.id,
      })
    } catch (error) {
      console.error("Failed to open checkout:", error)
      setError("Failed to open checkout. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  const isCurrentPlan = (tier: SubscriptionTier) => {
    return currentTier === tier
  }

  const getButtonText = (tier: SubscriptionTier) => {
    if (loading === tier) return "Loading..."
    if (isCurrentPlan(tier)) return "Current Plan"
    if (tier === "free") return "Downgrade to Free"
    return "Upgrade to Pro"
  }

  const getButtonVariant = (tier: SubscriptionTier) => {
    if (isCurrentPlan(tier)) return "outline" as const
    if (tier === "pro") return "default" as const
    return "outline" as const
  }

  // Don't render anything if user is not authenticated
  if (!user) {
    return null
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Plan Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {currentTier === "pro" && (
              <Crown className="h-5 w-5 text-purple-500" />
            )}
            <span className="font-medium">
              Current Plan: {currentTier === "free" ? "Free" : "Pro"}
            </span>
          </div>
          <Badge variant={currentTier === "pro" ? "default" : "outline"}>
            {currentTier === "free" ? "Free" : "Pro"}
          </Badge>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* Billing Period Toggle (only for upgrades) */}
      {currentTier === "free" && (
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
              Monthly ($9)
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "yearly"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              Yearly ($90)
              <Badge className="ml-2 bg-green-100 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                Save $18
              </Badge>
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
        {/* Free Plan Button */}
        {currentTier === "pro" && (
          <Button
            onClick={() => {
              // Handle downgrade to free - this would typically need backend support
              alert("Please contact support to downgrade your plan")
            }}
            variant="outline"
            className="flex-1"
            disabled={loading === "free"}
          >
            {getButtonText("free")}
          </Button>
        )}

        {/* Pro Plan Button */}
        {currentTier === "free" && (
          <Button
            onClick={() => handleUpgrade("pro")}
            disabled={loading === "pro" || !!error}
            variant={getButtonVariant("pro")}
            className="flex-1"
          >
            <Crown className="mr-2 h-4 w-4" />
            {getButtonText("pro")} -{" "}
            {billingPeriod === "monthly" ? "$9/month" : "$90/year"}
          </Button>
        )}

        {/* Manage Subscription Button for Pro users */}
        {currentTier === "pro" && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              // This would open subscription management
              alert("Subscription management coming soon")
            }}
          >
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Helpful Info */}
      <div className="text-center text-sm text-gray-600 dark:text-gray-300">
        {currentTier === "free" ? (
          <p>
            Upgrade to Pro to unlock more secrets, recipients, and flexible
            intervals.
          </p>
        ) : (
          <p>
            You have access to all Pro features. Need help? Contact support.
          </p>
        )}
      </div>
    </div>
  )
}
