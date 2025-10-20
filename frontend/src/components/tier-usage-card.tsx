"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Crown } from "lucide-react"
import Link from "next/link"

interface TierUsageCardProps {
  tier: "free" | "pro"
  secretsUsed: number
  secretsLimit: number
  canCreateMore: boolean
}

export function TierUsageCard({
  tier,
  secretsUsed,
  secretsLimit,
  canCreateMore,
}: TierUsageCardProps) {
  const percentageUsed = (secretsUsed / secretsLimit) * 100
  const isAtLimit = secretsUsed >= secretsLimit

  const getProgressColor = () => {
    if (percentageUsed >= 100) return "bg-destructive"
    if (percentageUsed >= 90) return "bg-destructive/80"
    if (percentageUsed >= 75) return "bg-muted-foreground"
    return ""
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Plan</CardTitle>
          <Badge
            variant={tier === "pro" ? "default" : "outline"}
            className="gap-1"
          >
            {tier === "pro" && <Crown className="h-3 w-3" />}
            {tier === "free" ? "Free" : "Pro"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Secrets Used</span>
            <span className="font-medium">
              {secretsUsed} of {secretsLimit}
            </span>
          </div>
          <Progress
            value={percentageUsed}
            className="h-2"
            indicatorClassName={getProgressColor()}
          />
        </div>

        {isAtLimit && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You've reached your {tier === "free" ? "free tier" : "plan"}{" "}
              limit.
              {tier === "free" && " Upgrade to Pro to create more secrets."}
            </AlertDescription>
          </Alert>
        )}

        {tier === "free" && (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">
              Upgrade to Pro for:
            </div>
            <ul className="ml-4 space-y-1 text-sm">
              <li>• 10 secrets (vs 1)</li>
              <li>• 5 recipients per secret</li>
              <li>• Custom check-in intervals</li>
              <li>• Message templates</li>
            </ul>
            <Button asChild className="mt-4 w-full">
              <Link href="/pricing">
                <Crown className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
          </div>
        )}

        {tier === "pro" && canCreateMore && (
          <div className="text-muted-foreground pt-2 text-center text-sm">
            You can create {secretsLimit - secretsUsed} more secret
            {secretsLimit - secretsUsed === 1 ? "" : "s"}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
