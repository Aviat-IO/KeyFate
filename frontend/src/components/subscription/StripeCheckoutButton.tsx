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
      // If user is not authenticated, redirect to login with return URL
      if (!session?.user) {
        const returnUrl = `${window.location.origin}/api/create-checkout-session?lookup_key=${lookupKey}&redirect_after_auth=true`
        const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`
        window.location.href = loginUrl
        return
      }

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lookup_key: lookupKey }),
      })

      if (response.redirected) {
        window.location.href = response.url
      } else if (response.status === 401) {
        // User session expired, redirect to login
        const returnUrl = `${window.location.origin}/api/create-checkout-session?lookup_key=${lookupKey}&redirect_after_auth=true`
        const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`
        window.location.href = loginUrl
      } else {
        const res = await response.json()
        console.error("Checkout failed", res)
        // You could show a toast notification here
      }
    } catch (error) {
      console.error("Error:", error)
      // You could show a toast notification here
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking authentication
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
