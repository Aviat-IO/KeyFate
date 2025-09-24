"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = () => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration.";
      case "AccessDenied":
        return "You do not have permission to sign in.";
      case "Verification":
        return "The verification token has expired or has already been used.";
      case "OAuthSignin":
        return "Error connecting to the authentication provider.";
      case "OAuthCallback":
        return "Error during the authentication process.";
      case "OAuthCreateAccount":
        return "Could not create an account with the provided information.";
      case "EmailCreateAccount":
        return "Could not create an account with this email address.";
      case "Callback":
        return "Error in the authentication callback.";
      case "OAuthAccountNotLinked":
        return "This email is already associated with another account. Please sign in using the original method.";
      case "EmailSignin":
        return "The email could not be sent. Please try again.";
      case "CredentialsSignin":
        return "Sign in failed. Check the details you provided are correct.";
      case "SessionRequired":
        return "Please sign in to access this page.";
      default:
        return "An unexpected error occurred during authentication.";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          {/* Error Icon */}
          <div className="mx-auto h-24 w-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-12 w-12 text-red-600"
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

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Authentication Error
          </h1>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">
              {getErrorMessage()}
            </p>
            {error && (
              <p className="text-red-600 text-xs mt-2">
                Error code: {error}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Link
              href="/sign-in"
              className="block w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Try signing in again
            </Link>

            <Link
              href="/"
              className="block w-full py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Return to home
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            If this error persists, please{" "}
            <Link
              href="/support"
              className="text-indigo-600 hover:text-indigo-500"
            >
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}