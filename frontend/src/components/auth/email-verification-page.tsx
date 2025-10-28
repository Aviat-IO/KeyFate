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
import { useToast } from "@/hooks/use-toast"
import {
  checkEmailVerificationStatus,
  verifyEmailWithOTP,
} from "@/lib/email-verification"
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ResendVerificationButton } from "./email-verification"
import { OTPInput } from "./otp-input"

export function EmailVerificationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { toast } = useToast()

  const [_otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyVerified, setAlreadyVerified] = useState(false)

  const email = searchParams.get("email") || session?.user?.email || ""
  useEffect(() => {
    if (success) {
      toast({
        title: "Email verified!",
        description: "Your email address has been successfully verified.",
      })
    }
  }, [success, toast])
  const callbackUrl =
    searchParams.get("callbackUrl") || searchParams.get("next") || "/dashboard"

  // Check verification status on load; if token present, attempt verify automatically
  const hasCheckedRef = useRef(false)
  useEffect(() => {
    if (status !== "authenticated") return
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    const checkStatus = async () => {
      try {
        const token = searchParams.get("token")
        if (token && email) {
          const result = await verifyEmailWithOTP(email, token)
          if (result.success) {
            setSuccess(true)
            toast({
              title: "Email verified!",
              description: "Your email address has been successfully verified.",
            })
            setTimeout(() => router.push(callbackUrl), 1500)
            return
          }
        }

        const verificationStatus = await checkEmailVerificationStatus(email)
        if (verificationStatus.isVerified) {
          setAlreadyVerified(true)
          toast({
            title: "Already verified",
            description: "Your email is already verified. Redirecting...",
          })
          setTimeout(() => router.push(callbackUrl), 2000)
        }
      } catch (err) {
        console.error("Failed to check verification status:", err)
      } finally {
        setChecking(false)
      }
    }

    checkStatus()
  }, [status, callbackUrl, router, toast, email, searchParams])

  const handleOTPComplete = async (otpValue: string) => {
    if (!email) {
      setError("Email address is required")
      return
    }

    setLoading(true)
    setError(null)

    setTimeout(() => {
      ; (async () => {
        try {
          const result = await verifyEmailWithOTP(email, otpValue)

          if (result.success) {
            setSuccess(true)
            toast({
              title: "Email verified!",
              description: "Your email address has been successfully verified.",
            })

            setTimeout(() => {
              router.push(callbackUrl)
            }, 1500)
          } else {
            setError(result.error || "Verification failed")
          }
        } catch (err) {
          console.error("Verification error:", err)
          setError("Network error. Please try again.")
        } finally {
          setLoading(false)
        }
      })()
    }, 20)
  }

  const handleOTPChange = (otpValue: string) => {
    setOtp(otpValue)
    if (error) setError(null) // Clear error when user starts typing
  }

  const handleResendSuccess = () => {
    setError(null)
    toast({
      title: "Email sent",
      description: "A new verification code has been sent to your email.",
    })
  }

  const handleResendError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const handleRetry = () => {
    setError(null)
    setOtp("")
  }

  if (status === "loading") {
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

  if (alreadyVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card data-testid="verification-card">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <CheckCircle2 className="text-accent-foreground mx-auto h-16 w-16" />
              <div>
                <h3 className="text-accent-foreground text-lg font-semibold">
                  Email Already Verified
                </h3>
                <p className="text-muted-foreground text-sm">
                  Your email address is already verified. Redirecting...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card data-testid="verification-card">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <CheckCircle2 className="text-accent-foreground mx-auto h-16 w-16" />
              <div>
                <h3 className="text-accent-foreground text-lg font-semibold">
                  Email Verified!
                </h3>
                <p className="text-muted-foreground text-sm">
                  Redirecting you to your destination...
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
      className="bg-secondary flex min-h-screen items-center justify-center px-4 py-16"
    >
      <Card className="w-full max-w-md" data-testid="verification-card">
        <CardHeader className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Mail className="text-muted-foreground h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Verify your email address
          </CardTitle>
          <CardDescription>
            We need to verify your email address before you can access the
            application.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {checking && (
            <div
              className="flex items-center justify-center space-x-2"
              role="status"
            >
              <Loader2
                className="h-4 w-4 animate-spin"
                data-testid="loading-spinner"
              />
              <span>Checking verification status...</span>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {error.includes("Network error") && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleRetry}
                    className="text-destructive hover:text-destructive/80 ml-2 h-auto p-0"
                  >
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">
              Enter the 8-digit code sent to{" "}
              <span className="font-medium">{email}</span>
            </p>

            <div className="space-y-4">
              <OTPInput
                onComplete={handleOTPComplete}
                onChange={handleOTPChange}
                disabled={false}
              />

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
          </div>

          <div className="space-y-3 text-center">
            <p className="text-muted-foreground text-sm">
              Didn't receive the email? Check your spam folder.
            </p>

            <ResendVerificationButton
              email={email}
              onSuccess={handleResendSuccess}
              onError={handleResendError}
              cooldownSeconds={60}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <Button
              onClick={() => router.push(callbackUrl)}
              className="w-full"
              variant="default"
            >
              Continue
            </Button>

            <Button
              onClick={() => router.push("/sign-in")}
              variant="ghost"
              className="text-muted-foreground w-full"
            >
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
