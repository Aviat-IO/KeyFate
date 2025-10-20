"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SubscriptionManager() {
  // Temporarily disabled during Supabase to NextAuth migration
  const loading = false
  const user = null

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
