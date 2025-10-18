"use client"

import { AuthForm } from "@/components/auth-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "next-auth/react"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  const validatePasswordClient = (pwd: string): string[] => {
    const errors: string[] = []

    if (pwd.length < 10) {
      errors.push("At least 10 characters long")
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      errors.push("One lowercase letter")
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      errors.push("One uppercase letter")
    }
    if (!/(?=.*\d)/.test(pwd)) {
      errors.push("One number")
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pwd)) {
      errors.push("One special character (!@#$%^&*)")
    }

    return errors
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (value) {
      const errors = validatePasswordClient(value)
      setValidationErrors(errors)
    } else {
      setValidationErrors([])
    }
  }

  const handleCredentialsSignUp = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    const clientErrors = validatePasswordClient(password)
    if (clientErrors.length > 0) {
      setError("Password does not meet requirements")
      setLoading(false)
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      setError("Please enter a valid email address")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Enhanced error handling with specific status codes
        let errorMessage = data.error || "Registration failed"

        switch (response.status) {
          case 400:
            if (
              data.error?.includes("already exists") ||
              data.error?.includes("already registered")
            ) {
              errorMessage =
                "An account with this email already exists. Please sign in instead."
            } else if (data.error?.includes("password")) {
              errorMessage = data.error
            } else if (data.error?.includes("email")) {
              errorMessage = "Please enter a valid email address"
            }
            break
          case 409:
            errorMessage =
              "An account with this email already exists. Please sign in instead."
            break
          case 422:
            errorMessage =
              data.error ||
              "Invalid registration data. Please check your information."
            break
          case 500:
            errorMessage = "Server error occurred. Please try again later."
            break
        }

        setError(errorMessage)
        setLoading(false)
        return // Prevent redirect on error
      }

      // Check if this was an existing user auto-login or new registration
      if (data.isExistingUser) {
        // User already existed and was auto-logged in
        window.location.href = nextUrl || "/"
        return
      }

      // New registration successful - show verification message
      setRegisteredEmail(email.toLowerCase().trim())
      setLoading(false)
    } catch (error) {
      console.error("Registration error:", error)
      let errorMessage = "An unexpected error occurred during registration"

      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage =
          "Network error. Please check your connection and try again."
      } else if (error instanceof Error) {
        errorMessage = `Registration failed: ${error.message}`
      }

      setError(errorMessage)
      setLoading(false) // Ensure loading state is cleared on error
    }
  }

  const handleResendVerification = async () => {
    if (!registeredEmail) return

    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: registeredEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to resend verification email")
      }
    } catch (error) {
      console.error("Resend error:", error)
      setError("Failed to resend verification email")
    } finally {
      setLoading(false)
    }
  }

  if (registeredEmail) {
    return (
      <AuthForm
        title="Check your email"
        description="We've sent you a verification link"
        leftLink={{ href: "/", text: "Back to home" }}
      >
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            We've sent a verification email to{" "}
            <span className="font-semibold">{registeredEmail}</span>. Please
            check your inbox and click the verification link to continue.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Didn't receive the email? Check your spam folder or request a new
            one.
          </p>

          <Button
            onClick={handleResendVerification}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Sending..." : "Resend verification email"}
          </Button>
        </div>
      </AuthForm>
    )
  }

  return (
    <AuthForm
      title="Create your account"
      description={
        <>
          Or{" "}
          <Link
            href={
              nextUrl
                ? `/sign-in?next=${encodeURIComponent(nextUrl)}`
                : "/sign-in"
            }
            className="text-primary hover:text-primary/90 transition hover:underline"
          >
            sign in
          </Link>{" "}
          if you already have an account
        </>
      }
      leftLink={{ href: "/", text: "Back to home" }}
      rightLink={{
        text: "Have an account?",
        linkText: "Sign in",
        href: nextUrl
          ? `/sign-in?next=${encodeURIComponent(nextUrl)}`
          : "/sign-in",
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleCredentialsSignUp} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            minLength={10}
          />
          {password && validationErrors.length > 0 && (
            <div className="text-muted-foreground text-sm">
              <p className="font-medium">Password must include:</p>
              <ul className="list-inside list-disc space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="text-red-600">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {password && validationErrors.length === 0 && (
            <p className="text-sm text-green-600">
              ✓ Password meets all requirements
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={10}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthForm>
  )
}
