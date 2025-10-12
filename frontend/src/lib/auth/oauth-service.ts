import { signIn, signOut, getSession } from "next-auth/react"
import type { Session } from "next-auth"

export interface OAuthResult {
  success: boolean
  error?: string
  user?: Session["user"]
}

export interface OAuthOptions {
  redirectTo?: string
}

export interface StateValidation {
  isValid: boolean
  error?: string
}

/**
 * Initiates Google OAuth flow
 */
export async function googleOAuthFlow(
  options: OAuthOptions = {},
): Promise<OAuthResult> {
  console.log("[OAuth] Initiating Google OAuth flow", {
    redirectTo: options.redirectTo,
    timestamp: new Date().toISOString(),
  })

  try {
    // For OAuth providers, signIn will redirect the browser to the provider
    // The redirect: true is implied for OAuth providers
    // After successful auth, NextAuth will redirect to callbackUrl
    await signIn("google", {
      callbackUrl: options.redirectTo || "/dashboard",
    })

    // This code won't be reached because signIn will redirect the page
    // But we return success to satisfy TypeScript
    return {
      success: true,
    }
  } catch (error) {
    // This catch block will only be reached if there's an error before the redirect
    console.error("[OAuth] Unexpected error during Google OAuth flow:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    return {
      success: false,
      error: "OAuth initialization failed",
    }
  }
}

/**
 * Handles OAuth callback and validates session
 */
export async function handleOAuthCallback(): Promise<OAuthResult> {
  console.log("[OAuth] Handling OAuth callback and session validation")

  try {
    const session = await getSession()

    if (!session?.user) {
      console.warn("[OAuth] No valid session found after callback", {
        sessionExists: !!session,
        timestamp: new Date().toISOString(),
      })

      return {
        success: false,
        error: "No valid session found",
      }
    }

    console.log("[OAuth] OAuth callback validated successfully", {
      userEmail: session.user.email,
      userName: session.user.name,
      provider: session.user.image ? "google" : "email",
      timestamp: new Date().toISOString(),
    })

    return {
      success: true,
      user: session.user as {
        id: string
        name?: string
        email?: string
        image?: string
      },
    }
  } catch (error) {
    console.error("[OAuth] OAuth callback validation error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    return {
      success: false,
      error: "Failed to validate OAuth callback",
    }
  }
}

/**
 * Validates OAuth state parameter for CSRF protection
 */
export function validateOAuthState(
  receivedState: string,
  expectedState: string,
): StateValidation {
  if (!receivedState || !expectedState) {
    return {
      isValid: false,
      error: "Missing state parameter",
    }
  }

  if (receivedState !== expectedState) {
    return {
      isValid: false,
      error: "Invalid state parameter",
    }
  }

  return {
    isValid: true,
  }
}

/**
 * Logs out user and redirects to sign-in page
 */
export async function logoutUser(
  callbackUrl: string = "/sign-in",
): Promise<void> {
  try {
    await signOut({ callbackUrl })
  } catch (error) {
    console.error("Logout error:", error)
    // Force redirect even if signOut fails
    window.location.href = callbackUrl
  }
}
