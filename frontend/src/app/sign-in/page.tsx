"use client"

import { AuthForm } from "@/components/auth-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { getCsrfToken } from "next-auth/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  const getNextAuthErrorMessage = (
    errorParam: string | null,
  ): string | null => {
    if (!errorParam) return null

    switch (errorParam) {
      case "CredentialsSignin":
        return "Invalid email or password. Please check your credentials and try again."
      case "Configuration":
        return "There is a problem with the authentication configuration. Please try again later."
      case "AccessDenied":
        return "Access denied. You do not have permission to sign in."
      case "Verification":
        return "The verification link has expired or has already been used."
      case "OAuthSignin":
      case "OAuthCallback":
      case "OAuthCreateAccount":
        return "Authentication provider error. Please try again."
      case "EmailCreateAccount":
        return "Could not create an account with this email address."
      case "Callback":
        return "Authentication callback error. Please try again."
      case "OAuthAccountNotLinked":
        return "This email is already associated with another account. Please use the original sign-in method."
      case "EmailSignin":
        return "Could not send verification email. Please try again."
      case "SessionRequired":
        return "Please sign in to access this page."
      default:
        return "An authentication error occurred. Please try again."
    }
  }

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      const errorMessage = getNextAuthErrorMessage(errorParam)
      setError(errorMessage)
    } else {
      setError(null)
    }
  }, [searchParams])

  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.has("error")) {
      currentUrl.searchParams.delete("error")
      window.history.replaceState({}, "", currentUrl.toString())
    }
  }, [])

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const csrfToken = await getCsrfToken()

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email,
          password,
          csrfToken: csrfToken || "",
          json: "true",
        }),
      })

      const data = await res.json()

      if (res.ok && !data.error) {
        const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
        window.location.href = callbackUrl
      } else {
        setError("Invalid email or password. Please try again.")
      }
    } catch (error) {
      console.error("Sign-in error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm
      title="Sign in to your account"
      description={
        <>
          Or{" "}
          <Link
            href={
              nextUrl
                ? `/sign-up?next=${encodeURIComponent(nextUrl)}`
                : "/sign-up"
            }
            className="text-primary hover:text-primary/90 transition hover:underline"
          >
            create an account
          </Link>{" "}
          if you don't have one yet
        </>
      }
      leftLink={{ href: "/", text: "Back to home" }}
      rightLink={{
        text: "Don't have an account?",
        linkText: "Sign up",
        href: nextUrl
          ? `/sign-up?next=${encodeURIComponent(nextUrl)}`
          : "/sign-up",
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleCredentialsSignIn} className="space-y-3">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthForm>
  )
}
