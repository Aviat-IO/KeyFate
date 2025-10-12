"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const getErrorMessage = () => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration."
      case "AccessDenied":
        return "You do not have permission to sign in."
      case "Verification":
        return "The verification token has expired or has already been used."
      case "OAuthSignin":
        return "Error connecting to the authentication provider."
      case "OAuthCallback":
        return "Error during the authentication process."
      case "OAuthCreateAccount":
        return "Could not create an account with the provided information."
      case "EmailCreateAccount":
        return "Could not create an account with this email address."
      case "Callback":
        return "Error in the authentication callback."
      case "OAuthAccountNotLinked":
        return "This email is already associated with another account. Please sign in using the original method."
      case "EmailSignin":
        return "The email could not be sent. Please try again."
      case "CredentialsSignin":
        return "Sign in failed. Check the details you provided are correct."
      case "SessionRequired":
        return "Please sign in to access this page."
      default:
        return "An unexpected error occurred during authentication."
    }
  }

  return (
    <div className="from-background to-secondary flex min-h-screen items-center justify-center bg-gradient-to-br px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          {/* Error Icon */}
          <div className="bg-destructive/10 mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full">
            <svg
              className="text-destructive h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-foreground mb-4 text-3xl font-bold">
            Authentication Error
          </h1>

          <div className="bg-destructive/10 border-destructive mb-6 rounded-lg border p-4">
            <p className="text-destructive-foreground text-sm">
              {getErrorMessage()}
            </p>
            {error && (
              <p className="text-destructive mt-2 text-xs">
                Error code: {error}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Link
              href="/sign-in"
              className="from-primary to-primary hover:from-primary hover:to-primary focus:ring-primary block w-full rounded-lg border border-transparent bg-gradient-to-r px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              Try signing in again
            </Link>

            <Link
              href="/"
              className="border-input text-foreground hover:bg-muted/50 focus:ring-primary block w-full rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              Return to home
            </Link>
          </div>

          <p className="text-muted-foreground mt-6 text-xs">
            If this error persists, please{" "}
            <Link href="/support" className="text-primary hover:text-primary">
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
