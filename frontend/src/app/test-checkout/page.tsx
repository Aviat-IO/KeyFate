"use client"

import { StripeCheckoutButton } from "@/components/subscription/StripeCheckoutButton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { signIn, signOut, useSession } from "next-auth/react"

export default function TestCheckoutPage() {
  const { data: session, status } = useSession()
  const loading = status === "loading"

  const handleLogin = async () => {
    await signIn("credentials", {
      email: "ceo@aviat.io",
      password: "password123",
      redirect: false,
    })
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Card>
        <CardHeader>
          <CardTitle>Checkout Test Page</CardTitle>
          <CardDescription>
            Test the Stripe checkout flow with authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Authentication Status:</h3>
            {session?.user ? (
              <div className="space-y-2">
                <p>✅ Logged in as: {session.user.email}</p>
                <p>User ID: {(session.user as any).id}</p>
                <Button onClick={handleLogout} variant="outline">
                  Logout
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p>❌ Not logged in</p>
                <Button onClick={handleLogin}>Login as ceo@aviat.io</Button>
              </div>
            )}
          </div>

          {session?.user && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 font-semibold">Test Checkout:</h3>
                <div className="space-y-2">
                  <StripeCheckoutButton lookupKey="pro_monthly">
                    Subscribe to Pro Monthly ($9/month)
                  </StripeCheckoutButton>

                  <StripeCheckoutButton lookupKey="pro_yearly">
                    Subscribe to Pro Yearly ($90/year)
                  </StripeCheckoutButton>
                </div>
              </div>

              <div className="bg-muted rounded-lg border p-4">
                <h3 className="mb-2 font-semibold">Debug Info:</h3>
                <p>Environment: {process.env.NODE_ENV}</p>
                <p>Site URL: {process.env.NEXT_PUBLIC_SITE_URL}</p>
                <p>
                  Stripe Publishable Key:{" "}
                  {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                    ? "Set"
                    : "Not set"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
