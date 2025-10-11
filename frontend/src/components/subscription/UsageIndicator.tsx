"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useSession } from "next-auth/react"

export function UsageIndicator() {
  // Temporarily disabled during Supabase to NextAuth migration
  const user = null
  const secretCount = 0
  const loading = false

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-4 w-3/4 rounded"></div>
            <div className="bg-muted h-4 w-full rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return null
  }

  const maxSecrets = 3 // Free plan limit
  const usagePercentage = (secretCount / maxSecrets) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Usage
          <Badge variant={usagePercentage >= 100 ? "destructive" : "secondary"}>
            {secretCount}/{maxSecrets}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Secrets</span>
            <span>
              {secretCount} of {maxSecrets}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>

        {usagePercentage >= 80 && (
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">
            {usagePercentage >= 100
              ? "You've reached your limit. Upgrade to create more secrets."
              : "You're approaching your limit. Consider upgrading soon."}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
