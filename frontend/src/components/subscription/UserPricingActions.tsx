"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { User } from "@supabase/supabase-js"

const supabase = createClient()

export function UserPricingActions() {
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Get Started</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Sign up for a free account to start using KeyFate.
          </p>
          <Button className="w-full">Sign Up Free</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Your Account
          <Badge>Free Plan</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">Email: {user.email}</p>
        </div>
        <Button className="w-full" variant="outline">
          Manage Subscription
        </Button>
      </CardContent>
    </Card>
  )
}
