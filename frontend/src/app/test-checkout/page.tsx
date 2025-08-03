"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { StripeCheckoutButton } from "@/components/subscription/StripeCheckoutButton"

const supabase = createClient()

export default function TestCheckoutPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: "ceo@aviat.io",
      password: "password123"
    })
    if (error) {
      console.error("Login error:", error)
    } else {
      window.location.reload()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Checkout Test Page</CardTitle>
          <CardDescription>
            Test the Stripe checkout flow with authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Authentication Status:</h3>
            {user ? (
              <div className="space-y-2">
                <p>✅ Logged in as: {user.email}</p>
                <p>User ID: {user.id}</p>
                <Button onClick={handleLogout} variant="outline">
                  Logout
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p>❌ Not logged in</p>
                <Button onClick={handleLogin}>
                  Login as ceo@aviat.io
                </Button>
              </div>
            )}
          </div>

          {user && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Test Checkout:</h3>
                <div className="space-y-2">
                  <StripeCheckoutButton lookupKey="pro_monthly">
                    Subscribe to Pro Monthly ($9/month)
                  </StripeCheckoutButton>

                  <StripeCheckoutButton lookupKey="pro_yearly">
                    Subscribe to Pro Yearly ($90/year)
                  </StripeCheckoutButton>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted">
                <h3 className="font-semibold mb-2">Debug Info:</h3>
                <p>Environment: {process.env.NODE_ENV}</p>
                <p>Site URL: {process.env.NEXT_PUBLIC_SITE_URL}</p>
                <p>Stripe Publishable Key: {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "Set" : "Not set"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
