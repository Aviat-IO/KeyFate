"use client"

import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useState } from "react"

interface StripeCheckoutButtonProps {
  lookupKey: string
  children: React.ReactNode
  disabled?: boolean
}

export function StripeCheckoutButton({
  lookupKey,
  children,
  disabled,
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const { data: session, status } = useSession()
  const checkingAuth = status === "loading"

  const handleCheckout = async () => {
    setLoading(true)

    try {
      if (!session?.user) {
        const checkoutUrl = `/api/create-checkout-session?lookup_key=${lookupKey}&redirect_after_auth=true`
        const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(checkoutUrl)}`
        window.location.href = loginUrl
        return
      }

      // Call our API to create a checkout session with user_id in metadata
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookup_key: lookupKey }),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Unknown error" }))
        console.error("Checkout session error:", error)
        throw new Error(error.error || "Failed to create checkout session")
      }

      // Get the checkout URL from JSON response
      const data = await response.json()
      if (data.url) {
        console.log("Redirecting to Stripe Checkout:", data.url)
        window.location.href = data.url
      } else {
        throw new Error("No checkout URL returned from API")
      }
    } catch (error) {
      console.error("Error creating checkout:", error)
      alert("Failed to start checkout. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <Button disabled className="w-full">
        Loading...
      </Button>
    )
  }

  return (
    <Button
      onClick={handleCheckout}
      disabled={disabled || loading}
      className="w-full"
    >
      {loading ? "Loading..." : children}
    </Button>
  )
}
