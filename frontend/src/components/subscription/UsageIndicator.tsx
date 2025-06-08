"use client"

import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Crown, Users, Lock } from "lucide-react"
import { UserTierInfo, SubscriptionTier } from "@/types/subscription"
import { getUserTierInfo } from "@/lib/subscription"
import { openSubscriptionCheckout } from "@/lib/paddle"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User } from "@supabase/supabase-js"

interface UsageIndicatorProps {
  variant?: "card" | "inline" | "compact"
  showUpgradeButton?: boolean
  className?: string
}

export function UsageIndicator({
  variant = "card",
  showUpgradeButton = true,
  className = "",
}: UsageIndicatorProps) {
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [tierInfo, setTierInfo] = useState<UserTierInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

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
    async function loadTierInfo() {
      if (!user?.id) return

      try {
        const info = await getUserTierInfo(user.id)
        setTierInfo(info)
      } catch (error) {
        console.error("Failed to load tier info:", error)
      } finally {
        setLoading(false)
      }
    }

    loadTierInfo()
  }, [user?.id])

  const handleUpgrade = async () => {
    if (!user?.email || !user?.id) return

    setUpgrading(true)
    try {
      await openSubscriptionCheckout("pro", "monthly", {
        email: user.email,
        userId: user.id,
      })
    } catch (error) {
      console.error("Failed to open checkout:", error)
    } finally {
      setUpgrading(false)
    }
  }

  if (loading || !tierInfo) {
    return variant === "compact" ? (
      <div className="h-4 animate-pulse rounded bg-gray-200" />
    ) : (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const { limits } = tierInfo

  // Determine tier from usage/subscription data
  const currentTier: SubscriptionTier = tierInfo.subscription ? "pro" : "free"
  const isFreeTier = currentTier === "free"

  // Calculate usage percentages
  const secretsUsagePercent =
    (limits.secrets.current / limits.secrets.max) * 100
  const isNearSecretsLimit = secretsUsagePercent >= 80
  const isAtSecretsLimit = !limits.secrets.canCreate

  // Determine urgency level
  const getUrgencyLevel = () => {
    if (isAtSecretsLimit) return "critical"
    if (isNearSecretsLimit) return "warning"
    return "normal"
  }

  const urgencyLevel = getUrgencyLevel()

  // Color schemes based on urgency
  const colorSchemes = {
    normal: {
      progress: "bg-blue-500",
      badge: "bg-blue-100 text-blue-800",
      border: "border-gray-200",
    },
    warning: {
      progress: "bg-yellow-500",
      badge: "bg-yellow-100 text-yellow-800",
      border: "border-yellow-200",
    },
    critical: {
      progress: "bg-red-500",
      badge: "bg-red-100 text-red-800",
      border: "border-red-200",
    },
  }

  const colors = colorSchemes[urgencyLevel]

  // Compact variant for inline display
  if (variant === "compact") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Badge
          variant={isFreeTier ? "outline" : "default"}
          className={colors.badge}
        >
          {isFreeTier ? "Free" : "Pro"}
        </Badge>
        <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300">
          <Lock className="h-3 w-3" />
          <span>
            {limits.secrets.current}/{limits.secrets.max}
          </span>
        </div>
        {isAtSecretsLimit && <AlertTriangle className="h-4 w-4 text-red-500" />}
      </div>
    )
  }

  // Inline variant for dashboard display
  if (variant === "inline") {
    return (
      <div
        className={`flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50 ${className}`}
      >
        <div className="flex items-center space-x-3">
          <Badge
            variant={isFreeTier ? "outline" : "default"}
            className={colors.badge}
          >
            {isFreeTier ? (
              <span className="flex items-center">Free Plan</span>
            ) : (
              <span className="flex items-center">
                <Crown className="mr-1 h-3 w-3" />
                Pro Plan
              </span>
            )}
          </Badge>
          <div className="text-sm">
            <span className="font-medium">{limits.secrets.current}</span>
            <span className="text-gray-500 dark:text-gray-400">
              /{limits.secrets.max} secrets
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Progress value={secretsUsagePercent} className="h-2 w-20" />
          {isFreeTier && showUpgradeButton && (
            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              size="sm"
              variant={isAtSecretsLimit ? "default" : "outline"}
            >
              {upgrading ? "Loading..." : "Upgrade"}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Full card variant
  return (
    <Card className={`${colors.border} ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            Usage & Limits
            {isAtSecretsLimit && (
              <AlertTriangle className="ml-2 h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <Badge
            variant={isFreeTier ? "outline" : "default"}
            className={colors.badge}
          >
            {isFreeTier ? (
              <span className="flex items-center">Free Plan</span>
            ) : (
              <span className="flex items-center">
                <Crown className="mr-1 h-3 w-3" />
                Pro Plan
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Secrets Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              <Lock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="font-medium">Secrets</span>
            </div>
            <span className="text-gray-600 dark:text-gray-300">
              {limits.secrets.current}/{limits.secrets.max}
            </span>
          </div>
          <Progress value={secretsUsagePercent} className="h-2" />
          {isAtSecretsLimit && (
            <p className="flex items-center text-sm text-red-600">
              <AlertTriangle className="mr-1 h-3 w-3" />
              You've reached your secrets limit
            </p>
          )}
        </div>

        {/* Recipients Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="font-medium">Recipients per secret</span>
            </div>
            <span className="text-gray-600 dark:text-gray-300">
              Up to {limits.recipients.max}
            </span>
          </div>
        </div>

        {/* Feature Highlights */}
        {isFreeTier && (
          <div className="space-y-2 pt-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p>• Limited to weekly, monthly, yearly intervals</p>
              <p>• Community support only</p>
              <p>• No message templates</p>
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        {isFreeTier && showUpgradeButton && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Need more?
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  Get 10 secrets, flexible intervals, and more
                </p>
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                size="sm"
                className="ml-4"
              >
                {upgrading ? "Loading..." : "Upgrade to Pro"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
