/**
 * Server-side Turnstile token verification
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  const isDev = process.env.NODE_ENV === "development"

  // Only allow bypass in development when no secret key is configured
  if (isDev && !secretKey) {
    console.warn(
      "[Turnstile] No secret key configured, bypassing in development",
    )
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
      },
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
