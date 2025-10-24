"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { OTPInput } from "@/components/auth/otp-input"

type AuthStep = "email" | "otp"

export default function SignInPage() {
  const [authStep, setAuthStep] = useState<AuthStep>("email")
  const [email, setEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [resendCountdown, setResendCountdown] = useState(0)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const urlError = searchParams.get("error")
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(
        () => setResendCountdown(resendCountdown - 1),
        1000,
      )
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  useEffect(() => {
    // Auto-focus email input when page loads or when returning to email step
    if (authStep === "email" && emailInputRef.current) {
      emailInputRef.current.focus()
    }
  }, [authStep])

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage(`Code sent to ${email}\nCheck your email`)
        setAuthStep("otp")
        setResendCountdown(60)
      } else if (response.status === 429) {
        setErrorMessage(
          data.resetAt
            ? `Too many requests. Please try again in ${Math.ceil((new Date(data.resetAt).getTime() - Date.now()) / 60000)} minutes.`
            : "Too many requests. Please try again later.",
        )
      } else {
        setErrorMessage(data.error || "Failed to send code. Please try again.")
      }
    } catch (error) {
      console.error("Request OTP error:", error)
      setErrorMessage("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (code: string) => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const csrfResponse = await fetch("/api/auth/csrf")
      const { csrfToken } = await csrfResponse.json()

      const formData = new URLSearchParams({
        csrfToken,
        email: email.toLowerCase().trim(),
        otpCode: code,
        action: "otp",
        callbackUrl,
      })

      const authResponse = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      })

      if (
        authResponse.url.includes(callbackUrl) ||
        authResponse.url.includes("/dashboard")
      ) {
        window.location.href = callbackUrl
      } else if (
        authResponse.url.includes("/auth/signin") ||
        authResponse.url.includes("error=")
      ) {
        setErrorMessage("Invalid or expired code. Please try again.")
        setOtpCode("")
      } else {
        const sessionResponse = await fetch("/api/auth/session")
        const session = await sessionResponse.json()

        if (session?.user) {
          window.location.href = callbackUrl
        } else {
          setErrorMessage("Invalid or expired code. Please try again.")
          setOtpCode("")
        }
      }
    } catch (error) {
      console.error("Verify OTP error:", error)
      setErrorMessage("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditEmail = () => {
    setAuthStep("email")
    setOtpCode("")
    setErrorMessage("")
    setSuccessMessage("")
  }

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return
    await handleRequestOTP(new Event("submit") as any)
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      await signIn("google", { callbackUrl })
      // Don't reset loading state here - let the OAuth flow handle the redirect
      // The loading state will persist until the user is redirected away
    } catch (error) {
      console.error("Google sign in error:", error)
      setErrorMessage("Google sign-in failed. Please try again.")
      setIsLoading(false) // Only reset loading on actual error
    }
  }

  // Helper function to get user-friendly error messages
  const getErrorMessage = (error: string | null, customError: string) => {
    if (customError) return customError
    if (!error) return null

    switch (error) {
      case "CredentialsSignin":
        return "Invalid email or password. Please check your credentials and try again."
      case "OAuthSignin":
        return "Error connecting to sign-in provider. Please try again."
      case "OAuthCallback":
        return "Error during authentication. Please try again."
      case "OAuthCreateAccount":
        return "Could not create account. Please try again."
      case "EmailCreateAccount":
        return "Could not create email account. Please try again."
      case "Callback":
        return "Error in authentication callback. Please try again."
      case "OAuthAccountNotLinked":
        return "Account not linked. Please use the same sign-in method you used before."
      case "EmailSignin":
        return "Check your email address and try again."
      case "SessionRequired":
        return "Please sign in to access this page."
      case "Default":
      default:
        return "Unable to sign in. Please try again."
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="bg-card border-border w-full max-w-md space-y-8 rounded-xl border p-8 shadow-lg">
        <div>
          <h2 className="text-foreground mt-6 text-center text-3xl font-extrabold">
            Sign in to KeyFate
          </h2>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Secure your digital legacy
          </p>
        </div>

        {getErrorMessage(urlError, errorMessage) && (
          <div className="border-destructive bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
            {getErrorMessage(urlError, errorMessage)}
          </div>
        )}

        {successMessage && (
          <div className="border-accent bg-accent/10 text-accent-foreground whitespace-pre-line rounded-lg border px-4 py-3 text-center text-sm">
            {successMessage}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {authStep === "email" ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="text-foreground block text-sm font-medium"
                >
                  Email address
                </label>
                <input
                  ref={emailInputRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary relative mt-1 block w-full appearance-none rounded-lg border px-3 py-2 focus:z-10 focus:outline-none sm:text-sm"
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring group relative flex w-full justify-center rounded-lg border border-transparent px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Sending code..." : "Continue with Email"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Enter 6-digit code
                </label>
                <OTPInput
                  length={6}
                  onComplete={handleVerifyOTP}
                  onChange={setOtpCode}
                  disabled={isLoading}
                />
              </div>

              <div className="text-center">
                {resendCountdown > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Resend code in {resendCountdown}s
                  </p>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-primary hover:text-primary text-sm font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </div>

              <div className="border-muted bg-muted text-muted-foreground rounded-lg border px-4 py-3 text-sm">
                <p className="font-medium">Didn't receive the code?</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
                  <li>Check your spam folder</li>
                  <li>Codes expire after 10 minutes</li>
                  <li>Wait 60 seconds before requesting a new code</li>
                </ul>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="border-input w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="text-muted-foreground bg-card px-2">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="border-input text-foreground hover:bg-secondary focus:ring-ring bg-card flex w-full items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </button>
        </div>

        {authStep === "email" && (
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              New to KeyFate? Just enter your email to get started.
            </p>
          </div>
        )}

        <p className="text-muted-foreground mt-4 text-center text-xs">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:text-primary">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:text-primary">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
