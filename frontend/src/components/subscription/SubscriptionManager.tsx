"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Crown,
  Calendar,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
} from "lucide-react"
import { UserTierInfo, SubscriptionTier } from "@/types/subscription"
import { getUserTierInfo } from "@/lib/subscription"
import {
  cancelSubscription,
  resumeSubscription,
  getSubscriptionManagementUrl,
} from "@/lib/paddle"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User } from "@supabase/supabase-js"

interface SubscriptionManagerProps {
  className?: string
}

export function SubscriptionManager({
  className = "",
}: SubscriptionManagerProps) {
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [tierInfo, setTierInfo] = useState<UserTierInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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

  const handleCancelSubscription = async () => {
    if (!tierInfo?.subscription?.paddle_subscription_id) return

    setActionLoading("cancel")
    try {
      await cancelSubscription(
        tierInfo.subscription.paddle_subscription_id,
        "at_period_end",
      )
      // Refresh tier info
      const updatedInfo = await getUserTierInfo(user.id)
      setTierInfo(updatedInfo)
    } catch (error) {
      console.error("Failed to cancel subscription:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResumeSubscription = async () => {
    if (!tierInfo?.subscription?.paddle_subscription_id) return

    setActionLoading("resume")
    try {
      await resumeSubscription(tierInfo.subscription.paddle_subscription_id)
      // Refresh tier info
      const updatedInfo = await getUserTierInfo(user.id)
      setTierInfo(updatedInfo)
    } catch (error) {
      console.error("Failed to resume subscription:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleManageBilling = async () => {
    if (!tierInfo?.subscription?.paddle_customer_id) return

    setActionLoading("billing")
    try {
      const managementUrl = await getSubscriptionManagementUrl(
        tierInfo.subscription.paddle_customer_id,
      )
      window.open(managementUrl, "_blank")
    } catch (error) {
      console.error("Failed to open billing management:", error)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading || !tierInfo) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-6 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const { tier, subscription } = tierInfo
  const currentTier: SubscriptionTier = subscription ? "pro" : "free"
  const isFreeTier = currentTier === "free"

  // Format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Get status info
  const getStatusInfo = () => {
    if (isFreeTier) {
      return {
        status: "Free Plan",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        icon: <CheckCircle className="h-4 w-4" />,
      }
    }

    if (!subscription) {
      return {
        status: "Unknown",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        icon: <AlertTriangle className="h-4 w-4" />,
      }
    }

    // For now, assume active subscription if it exists
    // TODO: Add status field to user_subscriptions table
    if (subscription.cancel_at_period_end) {
      return {
        status: "Canceling",
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        icon: <AlertTriangle className="h-4 w-4" />,
      }
    }

    return {
      status: "Active",
      color:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      icon: <CheckCircle className="h-4 w-4" />,
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Plan Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {isFreeTier ? (
                <CheckCircle className="h-5 w-5 text-blue-500" />
              ) : (
                <Crown className="h-5 w-5 text-purple-500" />
              )}
              <span>Current Plan</span>
            </CardTitle>
            <Badge className={statusInfo.color}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.status}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {isFreeTier ? "Free Plan" : "Pro Plan"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isFreeTier
                    ? "Perfect for getting started"
                    : "Full access to all premium features"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    Secrets
                  </span>
                  <span className="font-medium">{tier.max_secrets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    Recipients per secret
                  </span>
                  <span className="font-medium">
                    {tier.max_recipients_per_secret}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    Custom intervals
                  </span>
                  <span className="font-medium">
                    {tier.custom_intervals ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {!isFreeTier && subscription && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Billing Information</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage your subscription and billing
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      Current period
                    </span>
                    <span className="font-medium">
                      {formatDate(subscription.current_period_start)} -{" "}
                      {formatDate(subscription.current_period_end)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      Next billing
                    </span>
                    <span className="font-medium">
                      {subscription.cancel_at_period_end
                        ? "Canceled at period end"
                        : formatDate(subscription.current_period_end)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {isFreeTier ? (
              <Button
                onClick={() => (window.location.href = "/pricing")}
                className="flex items-center space-x-2"
              >
                <Crown className="h-4 w-4" />
                <span>Upgrade to Pro</span>
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleManageBilling}
                  disabled={actionLoading === "billing"}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>
                    {actionLoading === "billing"
                      ? "Loading..."
                      : "Manage Billing"}
                  </span>
                </Button>

                {false ? ( // TODO: Check actual subscription status when field is added
                  <Button
                    onClick={handleResumeSubscription}
                    disabled={actionLoading === "resume"}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>
                      {actionLoading === "resume"
                        ? "Loading..."
                        : "Resume Subscription"}
                    </span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleCancelSubscription}
                    disabled={
                      actionLoading === "cancel" ||
                      subscription?.cancel_at_period_end
                    }
                    variant="outline"
                    className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>
                      {actionLoading === "cancel"
                        ? "Loading..."
                        : subscription?.cancel_at_period_end
                          ? "Cancellation Scheduled"
                          : "Cancel Subscription"}
                    </span>
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Cancellation Notice */}
          {subscription?.cancel_at_period_end && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Subscription Cancellation Scheduled
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Your subscription will end on{" "}
                    {formatDate(subscription.current_period_end)}. You'll be
                    automatically moved to the free plan.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Usage Summary</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800/50">
              <div className="text-2xl font-bold text-blue-600">
                {tierInfo.usage.secrets_count}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Secrets Created
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800/50">
              <div className="text-2xl font-bold text-green-600">
                {tierInfo.usage.total_recipients}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Total Recipients
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800/50">
              <div className="text-2xl font-bold text-purple-600">
                {tier.max_secrets - tierInfo.usage.secrets_count}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Secrets Remaining
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
