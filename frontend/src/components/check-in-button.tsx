"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { APP_URL } from "@/lib/env"
import { Secret } from "@/types/secret"
import { Loader2 } from "lucide-react"
import { useState } from "react"

interface CheckInButtonProps {
  secretId: string
  onCheckInSuccess?: (secret: Secret) => void
}

export function CheckInButton({
  secretId,
  onCheckInSuccess,
}: CheckInButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    setLoading(true)

    try {
      const response = await fetch(
        `${APP_URL}/api/secrets/${secretId}/check-in`,
        {
          method: "POST",
        },
      )

      if (!response.ok) {
        throw new Error("Failed to check in")
      }

      const res = await response.json()
      const updatedSecret = res.secret as Secret

      onCheckInSuccess(updatedSecret)
    } catch (error) {
      console.error("Error checking in:", error)
      toast({
        variant: "destructive",
        title: "Check-in failed",
        description: "Please try again later.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleCheckIn}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking in...
        </>
      ) : (
        "Check In"
      )}
    </Button>
  )
}
