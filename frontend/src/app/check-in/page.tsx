"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { NEXT_PUBLIC_SUPABASE_URL } from "@/lib/env"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function CheckInContent() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const token = searchParams.get("token")

  if (!token) {
    return (
      <div className="mx-auto sm:px-4 py-8">
        <div className="mx-auto max-w-md pt-16 text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">
            Invalid Check-In Link
          </h1>
          <p className="text-muted-foreground">
            This check-in link is missing required information.
          </p>
        </div>
      </div>
    )
  }

  const handleCheckIn = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-in?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Check-in successful!",
          description: `Your secret "${data.secretTitle}" timer has been reset. Next check-in: ${data.nextCheckIn}`,
        })
      } else {
        throw new Error(data.error || "Check-in failed")
      }
    } catch (error) {
      console.error("Check-in error:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      toast({
        title: "Check-in failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto sm:px-4 py-8">
      <div className="mx-auto max-w-md space-y-6 pt-32 text-center">
        <h1 className="text-3xl font-bold">Secret Check-In</h1>

        <p className="text-muted-foreground">
          Click the button below to check in and reset your secret's timer.
        </p>

        <Button
          onClick={handleCheckIn}
          disabled={isLoading}
          size="lg"
          className="w-full"
        >
          {isLoading ? "Checking in..." : "Check In Now"}
        </Button>

        <p className="text-muted-foreground text-sm">
          This will update your last check-in time and prevent your secret from
          being triggered.
        </p>
      </div>
    </div>
  )
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckInContent />
    </Suspense>
  )
}
