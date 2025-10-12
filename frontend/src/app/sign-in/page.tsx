"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SocialButtons } from "@/components/ui/social-buttons"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

function SocialButtonsSeparator() {
  const [showSeparator, setShowSeparator] = useState(false)

  useEffect(() => {
    const checkProviders = async () => {
      try {
        const response = await fetch("/api/auth/providers")
        const data = await response.json()
        setShowSeparator(data.google) // Show separator if Google OAuth is available
      } catch (error) {
        console.error("Failed to check provider status:", error)
      }
    }

    checkProviders()
  }, [])

  if (!showSeparator) {
    return null
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background text-muted-foreground px-2">
          Or continue with
        </span>
      </div>
    </div>
  )
}

function SignInContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  // Get NextAuth error message from URL parameters
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

  // Check for NextAuth errors on component mount and URL changes
  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      const errorMessage = getNextAuthErrorMessage(errorParam)
      setError(errorMessage)
    } else {
      // Clear any existing errors when no URL error is present
      setError(null)
    }
  }, [searchParams])

  // Clear URL errors when component mounts to start fresh
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
    setError(null) // Clear any existing errors

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false, // Prevent NextAuth from redirecting
        callbackUrl: searchParams.get("callbackUrl") || "/",
      })

      if (result?.ok && !result?.error) {
        // Successful login - redirect to callback URL or home
        const callbackUrl = searchParams.get("callbackUrl") || "/"
        window.location.href = callbackUrl
      } else {
        // Authentication failed - show error and stay on page
        const errorMessage = result?.error
          ? getNextAuthErrorMessage(result.error) ||
            "Invalid email or password. Please try again."
          : "Invalid email or password. Please try again."
        setError(errorMessage)
      }
    } catch (error) {
      console.error("Sign-in error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Welcome back! Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SocialButtons />

          <SocialButtonsSeparator />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCredentialsSignIn} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
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

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              Don't have an account?{" "}
            </span>
            <Link href="/auth/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-md px-4 py-8">Loading...</div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
