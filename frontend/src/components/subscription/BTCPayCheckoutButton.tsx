"use client"

import { Button } from "@/components/ui/button"
import { useCSRF } from "@/hooks/useCSRF"
import { Subscription } from "@/lib/payment/interfaces/PaymentProvider"
import { Bitcoin } from "lucide-react"
import { useSession } from "next-auth/react"
import { useState } from "react"

interface BTCPayCheckoutButtonProps {
  amount: number
  currency?: string
  mode?: "payment" | "subscription"
  interval?: Subscription["interval"]
  children: React.ReactNode
  disabled?: boolean
}

export function BTCPayCheckoutButton({
  amount,
  currency = "USD",
  mode = "payment",
  interval,
  children,
  disabled,
}: BTCPayCheckoutButtonProps) {
  const { fetchWithCSRF } = useCSRF()
  const [loading, setLoading] = useState(false)
  const { data: session, status } = useSession()
  const checkingAuth = status === "loading"

  const handleCheckout = async () => {
    setLoading(true)

    try {
      if (!session?.user) {
        const params = new URLSearchParams({
          amount: String(amount),
          currency,
          mode,
          redirect_after_auth: "true",
        })
        if (interval) {
          params.set("interval", interval)
        }
        const returnUrl = `${window.location.origin}/api/create-btcpay-checkout?${params.toString()}`
        const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`
        window.location.href = loginUrl
        return
      }

      const response = await fetchWithCSRF("/api/create-btcpay-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, mode, interval }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else if (response.status === 401) {
        const params = new URLSearchParams({
          amount: String(amount),
          currency,
          mode,
          redirect_after_auth: "true",
        })
        if (interval) {
          params.set("interval", interval)
        }
        const returnUrl = `${window.location.origin}/api/create-btcpay-checkout?${params.toString()}`
        const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`
        window.location.href = loginUrl
      } else {
        const res = await response.json()
        console.error("BTCPay checkout failed", res)
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
      variant="default"
    >
      <Bitcoin className="mr-2 h-4 w-4" />
      {loading ? "Loading..." : children}
    </Button>
  )
}
