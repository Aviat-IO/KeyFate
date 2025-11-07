"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"
import { StripeCheckoutButton } from "./StripeCheckoutButton"
import { AlreadySubscribedDialog } from "./AlreadySubscribedDialog"
import { Button } from "@/components/ui/button"

interface PaymentMethodSelectorProps {
  amount: number
  interval: "monthly" | "yearly"
  lookupKey: string
  userTier?: string
  userTierDisplayName?: string
}

export function PaymentMethodSelector({
  amount,
  interval,
  lookupKey,
  userTier,
  userTierDisplayName,
}: PaymentMethodSelectorProps) {
  const [showDialog, setShowDialog] = useState(false)

  // Check if user is already a paid subscriber (not free tier)
  const isPaidUser = userTier && userTier !== "free"

  const handlePaymentClick = (e: React.MouseEvent) => {
    if (isPaidUser) {
      e.preventDefault()
      e.stopPropagation()
      setShowDialog(true)
    }
  }

  if (isPaidUser) {
    return (
      <>
        <div className="grid grid-cols-1 gap-3">
          <Button
            variant="default"
            className="w-full"
            onClick={handlePaymentClick}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Card
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handlePaymentClick}
            disabled
          >
            Bitcoin (coming soon)
          </Button>
        </div>
        <AlreadySubscribedDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          tierName={userTierDisplayName || userTier}
        />
      </>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <StripeCheckoutButton lookupKey={lookupKey}>
        <CreditCard className="mr-2 h-4 w-4" />
        Card
      </StripeCheckoutButton>

      <Button variant="outline" className="w-full" disabled>
        Bitcoin (coming soon)
      </Button>
    </div>
  )
}
