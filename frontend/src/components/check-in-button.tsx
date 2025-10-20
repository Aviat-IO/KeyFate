"use client"

import { Button } from "@/components/ui/button"
import { useConfig } from "@/contexts/ConfigContext"
import { useToast } from "@/hooks/use-toast"
import { mapApiSecretToDrizzleShape } from "@/lib/db/secret-mapper"
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
  const { config } = useConfig()
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    setLoading(true)

    try {
      // Use config from context, fallback to relative URL if not available
      const siteUrl = config?.siteUrl || ""
      const baseUrl = siteUrl
        ? siteUrl.startsWith("http")
          ? siteUrl
          : `http://${siteUrl}`
        : ""

      const response = await fetch(
        `${baseUrl}/api/secrets/${secretId}/check-in`,
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
      const apiSecret = res.secret

      // Convert API response (snake_case) to Drizzle format (camelCase)
      const updatedSecret = mapApiSecretToDrizzleShape(apiSecret)

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
