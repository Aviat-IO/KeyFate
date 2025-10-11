"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

export function EmailVerificationPageNextAuth() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [lastResendTime, setLastResendTime] = useState<number>(0)
  const [resendCooldown, setResendCooldown] = useState<number>(0)

  // Constants for better maintainability
  const RATE_LIMIT_SECONDS = 60
  const SUCCESS_REDIRECT_DELAY = 2000

  const email = searchParams.get("email") || session?.user?.email || ""
  const token = searchParams.get("token")
  const callbackUrl =
    searchParams.get("callbackUrl") || searchParams.get("next") || "/dashboard"

  // Helper functions
  const getRemainingCooldownTime = () => {
    if (!lastResendTime) return 0
    const now = Date.now()
    const rateLimitMs = RATE_LIMIT_SECONDS * 1000
    const elapsed = now - lastResendTime
    return elapsed < rateLimitMs ? Math.ceil((rateLimitMs - elapsed) / 1000) : 0
  }

  const isResendDisabled = () => {
    return resendingEmail || !email || getRemainingCooldownTime() > 0
  }

  // Check verification status on mount and handle token verification
  useEffect(() => {
    if (token && email) {
      handleTokenVerification(token, email)
    } else if (status === "authenticated" && (session?.user as any)?.id) {
      checkVerificationStatus()
    } else if (status === "unauthenticated") {
      setChecking(false)
    } else if (status === "loading") {
      // Still loading session, keep checking state
      return
    } else {
      setChecking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, email, status])

  // Update countdown timer
  useEffect(() => {
    if (lastResendTime && getRemainingCooldownTime() > 0) {
      const interval = setInterval(() => {
        setResendCooldown(getRemainingCooldownTime())
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [lastResendTime])

  const checkVerificationStatus = useCallback(async () => {
    setError(null)

    try {
      const response = await fetch("/api/auth/verification-status", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (result.success) {
        if (result.isVerified) {
          // User is already verified, redirect them
          setAlreadyVerified(true)
          router.push(callbackUrl)
          return
        }
        // User is not verified, show verification page
        setChecking(false)
      } else {
        setError(result.error || "Failed to check verification status")
        setChecking(false)
      }
    } catch (err) {
      console.error("Verification status check error:", err)
      setError("Network error. Please try again.")
      setChecking(false)
    }
  }, [router, callbackUrl])

  const handleTokenVerification = useCallback(
    async (verificationToken: string, emailAddress: string) => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/auth/verify-email-nextauth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: verificationToken,
            email: emailAddress,
          }),
        })

        const result = await response.json()

        if (result.success) {
          setSuccess(true)
          toast({
            title: "Email verified!",
            description: "Your email address has been successfully verified.",
          })

          // Brief delay to show success message, then redirect
          setTimeout(() => {
            router.push(callbackUrl)
          }, SUCCESS_REDIRECT_DELAY)
        } else {
          setError(result.error || "Verification failed")
        }
      } catch (err) {
        console.error("Verification error:", err)
        setError("Network error. Please try again.")
      } finally {
        setLoading(false)
        setChecking(false)
      }
    },
    [router, callbackUrl, toast],
  )

  const handleResendVerification = async () => {
    if (!email) {
      setError("Email address is required")
      return
    }

    if (resendingEmail) {
      return // Prevent rapid clicks
    }

    // Rate limiting with constant
    const now = Date.now()
    const rateLimitMs = RATE_LIMIT_SECONDS * 1000
    if (now - lastResendTime < rateLimitMs) {
      const remainingTime = Math.ceil(
        (rateLimitMs - (now - lastResendTime)) / 1000,
      )
      setError(
        `Please wait ${remainingTime} seconds before requesting another email`,
      )
      return
    }

    setResendingEmail(true)
    setError(null)
    setLastResendTime(now)

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Email sent",
          description:
            "A new verification email has been sent to your email address.",
        })
      } else {
        setError(result.error || "Failed to resend verification email")
      }
    } catch (err) {
      console.error("Resend error:", err)
      setError("Network error. Please try again.")
    } finally {
      setResendingEmail(false)
    }
  }

  if (status === "loading" || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2
            className="h-4 w-4 animate-spin"
            data-testid="loading-spinner"
          />
          <span>Checking verification status...</span>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/sign-in")
    return null
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card data-testid="verification-card">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <CheckCircle2
                className="text-accent-foreground mx-auto h-16 w-16"
                aria-label="Success checkmark"
                role="img"
              />
              <div>
                <h1 className="text-accent-foreground text-lg font-semibold">
                  Email Verified!
                </h1>
                <p className="text-muted-foreground text-sm">
                  Your email address has been successfully verified.
                  Redirecting...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div
      data-testid="verification-container"
      className="flex min-h-screen items-center justify-center bg-secondary px-4 py-16"
    >
      <Card className="w-full max-w-md" data-testid="verification-card">
        <CardHeader className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Mail className="text-muted-foreground h-6 w-6" />
          </div>
          <h1 className="text-card-foreground text-2xl font-bold">
            Verify your email address
          </h1>
          <CardDescription>
            We need to verify your email address before you can access the
            application.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Always present alert for accessibility, conditionally visible */}
          <Alert
            variant={error ? "destructive" : "default"}
            role="alert"
            id="error-message"
            aria-live="polite"
            className={error ? "" : "sr-only"}
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error || "No errors"}</AlertDescription>
          </Alert>

          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Please check your email at{" "}
              <span className="font-medium">{email}</span> and click the
              verification link.
            </p>

            {loading && (
              <div className="text-muted-foreground flex items-center justify-center space-x-2 text-sm">
                <Loader2
                  className="h-4 w-4 animate-spin"
                  data-testid="loading-spinner"
                />
                <span>Verifying...</span>
              </div>
            )}
          </div>

          <div className="space-y-3 text-center">
            <p className="text-muted-foreground text-sm">
              Didn't receive the email? Check your spam folder.
            </p>

            <Button
              onClick={handleResendVerification}
              disabled={isResendDisabled()}
              variant="outline"
              className="w-full"
              aria-describedby={error ? "error-message" : undefined}
              tabIndex={0}
            >
              {resendingEmail ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    data-testid="loading-spinner"
                  />
                  Sending...
                </>
              ) : getRemainingCooldownTime() > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Wait {getRemainingCooldownTime()}s
                </>
              ) : (
                "Resend verification email"
              )}
            </Button>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Button
              onClick={() => router.push("/sign-in")}
              variant="ghost"
              className="w-full text-muted-foreground"
              tabIndex={0}
            >
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
