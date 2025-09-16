"use client"

import { CreditCard } from "lucide-react"
import { BTCPayCheckoutButton } from "./BTCPayCheckoutButton"
import { StripeCheckoutButton } from "./StripeCheckoutButton"

interface PaymentMethodSelectorProps {
  amount: number
  interval: "monthly" | "yearly"
  lookupKey: string
}

export function PaymentMethodSelector({
  amount,
  interval,
  lookupKey,
}: PaymentMethodSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <StripeCheckoutButton lookupKey={lookupKey}>
        <CreditCard className="mr-2 h-4 w-4" />
        Card
      </StripeCheckoutButton>

      <BTCPayCheckoutButton
        amount={amount}
        currency="USD"
        mode="subscription"
        interval={interval === "monthly" ? "month" : "year"}
      >
        Bitcoin (Lightning)
      </BTCPayCheckoutButton>
    </div>
  )
}
