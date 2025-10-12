"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useSearchParams } from "next/navigation"
import { Suspense, useRef, useState } from "react"
import confetti from "canvas-confetti"

function CheckInContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccessful, setIsSuccessful] = useState(false)
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const token = searchParams.get("token")

  if (!token) {
    return (
      <div className="mx-auto py-8 sm:px-4">
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
        `/api/check-in?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      )

      // Log response details for debugging
      console.log("Check-in response:", {
        status: response.status,
        contentType: response.headers.get("content-type"),
        url: response.url,
      })

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        // If not JSON, get the text to see what was returned
        const text = await response.text()
        console.error("Non-JSON response received:", text.substring(0, 500))
        throw new Error(
          "Server returned an error. Please try again or contact support.",
        )
      }

      const data = await response.json()

      if (response.ok) {
        setIsSuccessful(true)

        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect()
          const x = (rect.left + rect.width / 2) / window.innerWidth
          const y = (rect.top + rect.height / 2) / window.innerHeight

          confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"],
          })
        }

        toast({
          title: "Check-in successful!",
          description: data.message ?? `Next check-in: ${data.nextCheckIn}`,
          variant: "success",
          persistent: true,
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
    <div className="mx-auto py-8 sm:px-4">
      <div className="mx-auto max-w-md space-y-6 pt-32 text-center">
        <h1 className="text-3xl font-bold">Secret Check-In</h1>

        <p className="text-muted-foreground">
          {isSuccessful
            ? "Your secret's timer has been successfully reset. You can close this page."
            : "Click the button below to check in and reset your secret's timer."}
        </p>

        <Button
          ref={buttonRef}
          onClick={handleCheckIn}
          disabled={isLoading || isSuccessful}
          size="lg"
          className="w-full"
        >
          {isLoading
            ? "Checking in..."
            : isSuccessful
              ? "Check-in Complete"
              : "Check In Now"}
        </Button>

        {!isSuccessful && (
          <p className="text-muted-foreground text-sm">
            This will update your last check-in time and prevent your secret
            from being triggered.
          </p>
        )}
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
