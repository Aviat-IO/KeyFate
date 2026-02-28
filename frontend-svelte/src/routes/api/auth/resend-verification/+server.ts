import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { resendVerificationEmail } from "$lib/auth/email-verification"
import { checkRateLimit } from "$lib/auth/rate-limiting"
import { z } from "zod"

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const POST: RequestHandler = async (event) => {
  try {
    let body
    try {
      body = await event.request.json()
    } catch {
      return json(
        {
          success: false,
          error: "Invalid request format",
        },
        { status: 400 },
      )
    }

    // Validate request body
    const validation = resendVerificationSchema.safeParse(body)
    if (!validation.success) {
      return json(
        {
          success: false,
          error: "Invalid email address",
          details: validation.error.issues,
        },
        { status: 400 },
      )
    }

    const { email } = validation.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      "resend-verification",
      normalizedEmail,
    )
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many resend attempts. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.retryAfter?.toString() || "1800",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toISOString(),
          },
        },
      )
    }

    // Log resend attempt for security monitoring
    console.log(
      `[ResendVerification] Verification email sent for: ${normalizedEmail}`,
    )

    // Resend verification email
    const result = await resendVerificationEmail(email)

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Failed to resend verification email",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toISOString(),
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification email sent successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toISOString(),
        },
      },
    )
  } catch (error) {
    console.error("[ResendVerification] Unexpected error:", error)

    return json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}
