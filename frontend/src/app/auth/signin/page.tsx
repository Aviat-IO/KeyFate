"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const urlError = searchParams.get("error")

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setErrorMessage("Invalid email or password. Please try again.")
      } else if (result?.ok) {
        window.location.href = callbackUrl
      }
    } catch (error) {
      console.error("Sign in error:", error)
      setErrorMessage("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Sign in to KeyFate
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Secure your digital legacy
          </p>
        </div>

        {getErrorMessage(urlError, errorMessage) && (
          <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(urlError, errorMessage)}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Credentials Sign In */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative mt-1 block w-full appearance-none rounded-lg border border-input px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative mt-1 block w-full appearance-none rounded-lg border border-input px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="Password"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-lg border border-transparent bg-gradient-to-r from-primary to-primary px-4 py-2 text-sm font-medium text-white hover:from-primary hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-input" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              href={`/auth/signup${callbackUrl !== "/dashboard" ? `?next=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="font-medium text-primary hover:text-primary"
            >
              Sign up
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:text-primary">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-primary hover:text-primary"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
