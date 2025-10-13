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
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  const handleCredentialsSignUp = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    // Additional client-side validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    // Better email validation
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

      // New registration successful, now sign in
      const signInResult = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError(
          "Account created successfully, but automatic sign-in failed. Please sign in manually.",
        )
        setLoading(false)
        return // Prevent redirect on sign-in error
      } else if (signInResult?.ok) {
        // Successful registration and login
        window.location.href = nextUrl || "/"
      } else {
        setError(
          "Account created successfully, but sign-in failed. Please try signing in manually.",
        )
        setLoading(false)
      }
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
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <p className="text-muted-foreground text-xs">
            Must be at least 8 characters with uppercase, lowercase, and a
            number
          </p>
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
            minLength={8}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthForm>
  )
}
