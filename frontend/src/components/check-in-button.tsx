"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env"
import { Secret } from "@/types"
import { CheckCircle, Loader2 } from "lucide-react"
import { useState } from "react"

interface CheckInButtonProps {
  secretId: string
  onCheckInSuccess?: (secret: Secret) => void
  variant?: "default" | "outline" | "ghost"
}

export function CheckInButton({
  secretId,
  onCheckInSuccess,
  variant = "outline",
}: CheckInButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    setLoading(true)

    try {
      const response = await fetch(
        `${NEXT_PUBLIC_SITE_URL}/api/secrets/${secretId}/check-in`,
        {
          method: "POST",
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `HTTP ${response.status}: ${errorData.error || response.statusText}`,
        )
      }

      const res = await response.json()
      const updatedSecret = res.secret as Secret

      onCheckInSuccess?.(updatedSecret)
    } catch (error) {
      console.error("Error checking in:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"

      toast({
        variant: "destructive",
        title: "Check-in failed",
        description: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleCheckIn}
      disabled={loading}
      variant={variant}
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking in...
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4" />
          Check In
        </>
      )}
    </Button>
  )
}
