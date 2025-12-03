"use client"

import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile"
import { useRef, forwardRef, useImperativeHandle } from "react"

export interface TurnstileRef {
  reset: () => void
  getToken: () => string | undefined
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void
  onError?: () => void
  onExpire?: () => void
}

export const TurnstileWidget = forwardRef<TurnstileRef, TurnstileWidgetProps>(
  function TurnstileWidget({ onSuccess, onError, onExpire }, ref) {
    const turnstileRef = useRef<TurnstileInstance>(null)
    const tokenRef = useRef<string | undefined>(undefined)

    useImperativeHandle(ref, () => ({
      reset: () => {
        tokenRef.current = undefined
        turnstileRef.current?.reset()
      },
      getToken: () => tokenRef.current,
    }))

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

    // In development or if no site key, render nothing (allow form submission)
    if (!siteKey) {
      // Call onSuccess with a dummy token in dev mode
      if (process.env.NODE_ENV === "development") {
        // Auto-succeed in development
        setTimeout(() => onSuccess("dev-bypass-token"), 100)
      }
      return null
    }

    return (
      <div className="flex justify-center">
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={(token) => {
            tokenRef.current = token
            onSuccess(token)
          }}
          onError={() => {
            tokenRef.current = undefined
            onError?.()
          }}
          onExpire={() => {
            tokenRef.current = undefined
            onExpire?.()
          }}
          options={{
            theme: "auto",
            size: "normal",
          }}
        />
      </div>
    )
  }
)

/**
 * Server-side Turnstile token verification
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  const isDev = process.env.NODE_ENV === "development"

  // Only allow bypass in development when no secret key is configured
  if (isDev && !secretKey) {
    console.warn("[Turnstile] No secret key configured, bypassing in development")
    return true
  }

  // In production, require secret key
  if (!secretKey) {
    console.error("[Turnstile] TURNSTILE_SECRET_KEY not configured")
    return false
  }

  // Never accept dev bypass token in production
  if (token === "dev-bypass-token") {
    return isDev
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
        }),
      }
    )

    if (!response.ok) {
      console.error(`[Turnstile] API error: ${response.status}`)
      return false
    }

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error("[Turnstile] Verification error:", error)
    return false
  }
}
