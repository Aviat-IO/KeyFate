"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { User } from "@supabase/supabase-js"

const supabase = createClient()

export function SubscriptionManager() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
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
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Subscription
          <Badge>Free</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            <strong>Plan:</strong> Free
          </p>
          <p className="text-sm">
            <strong>Status:</strong> Active
          </p>
        </div>

        <div className="space-y-2">
          <Button className="w-full">Upgrade to Pro</Button>
          <Button variant="outline" className="w-full">
            View Billing History
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
