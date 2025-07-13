"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { User } from "@supabase/supabase-js"

const supabase = createClient()

export function UsageIndicator() {
  const [user, setUser] = useState<User | null>(null)
  const [secretCount, setSecretCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUserAndSecrets() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUser(user)

        // Get secret count
        const { count } = await supabase
          .from("secrets")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)

        setSecretCount(count || 0)
      }

      setLoading(false)
    }

    getUserAndSecrets()
  }, [])

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
          <div className="text-sm text-orange-600 dark:text-orange-400">
            {usagePercentage >= 100
              ? "You've reached your limit. Upgrade to create more secrets."
              : "You're approaching your limit. Consider upgrading soon."}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
