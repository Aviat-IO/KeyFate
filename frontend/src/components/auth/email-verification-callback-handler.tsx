"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getEmailVerificationStatus } from "@/lib/email-verification"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export function EmailVerificationCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Priority: callbackUrl > next > default
  const callbackUrl =
    searchParams.get("callbackUrl") || searchParams.get("next") || "/dashboard"

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const status = await getEmailVerificationStatus()

        if (status.isVerified) {
          // Email is verified, redirect to intended destination
          router.push(callbackUrl)
        } else {
          // Not verified, redirect to verification page with callback preserved
          const verificationUrl = new URL(
            "/auth/verify-email",
            window.location.origin,
          )
          verificationUrl.searchParams.set("callbackUrl", callbackUrl)
          router.push(verificationUrl.toString())
        }
      } catch (err) {
        console.error("Error checking verification status:", err)
        setError("Error checking verification status. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    handleCallback()
  }, [router, callbackUrl])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    // Re-trigger the effect by changing a state that causes re-render
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
          <div>
            <h2 className="text-lg font-semibold">
              Checking verification status...
            </h2>
            <p className="text-muted-foreground text-sm">
              Please wait while we verify your email.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="text-destructive h-5 w-5" />
              <span>Verification Error</span>
            </CardTitle>
            <CardDescription>
              There was a problem checking your email verification status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button onClick={handleRetry} className="w-full">
                Try Again
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/auth/verify-email")}
                className="w-full"
              >
                Go to Email Verification
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // This component handles redirects, so we shouldn't render anything in success case
  return (
    <div
      data-testid="callback-handler"
      data-callback={callbackUrl}
      className="flex min-h-screen items-center justify-center"
    >
      <div className="text-center">
        <Loader2 className="text-primary mx-auto h-6 w-6 animate-spin" />
        <p className="text-muted-foreground mt-2 text-sm">Redirecting...</p>
      </div>
    </div>
  )
}
