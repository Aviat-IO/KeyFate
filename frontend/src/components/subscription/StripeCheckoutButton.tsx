"use client"

import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useState } from "react"

interface StripeCheckoutButtonProps {
  lookupKey: string
  children: React.ReactNode
  disabled?: boolean
}

const PAYMENT_LINKS: Record<string, string> = {
  pro_monthly: "https://buy.stripe.com/test_9B66oH3lU3f27R27MD14402",
  pro_yearly: "https://buy.stripe.com/test_7sY28r4pY16U0oAc2T14403",
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
        const paymentLink = PAYMENT_LINKS[lookupKey]
        const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(paymentLink)}`
        window.location.href = loginUrl
        return
      }

      const paymentLink = PAYMENT_LINKS[lookupKey]
      if (paymentLink) {
        window.location.href = paymentLink
      } else {
        console.error("No payment link found for lookup key:", lookupKey)
      }
    } catch (error) {
      console.error("Error:", error)
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
