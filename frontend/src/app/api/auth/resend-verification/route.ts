import { NextRequest, NextResponse } from "next/server"
import { resendVerificationEmail } from "@/lib/auth/email-verification"
import { checkRateLimit } from "@/lib/auth/rate-limiting"
import { z } from "zod"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
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
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email address",
          details: validation.error.errors,
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
      const response = NextResponse.json(
        {
          success: false,
          error: "Too many resend attempts. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 },
      )

      response.headers.set(
        "Retry-After",
        rateLimitResult.retryAfter?.toString() || "1800",
      )
      response.headers.set("X-RateLimit-Remaining", "0")
      response.headers.set(
        "X-RateLimit-Reset",
        rateLimitResult.resetTime.toISOString(),
      )

      return response
    }

    // Log resend attempt for security monitoring
    console.log(
      `[ResendVerification] Verification email sent for: ${normalizedEmail}`,
    )

    // Resend verification email
    const result = await resendVerificationEmail(email)

    if (!result.success) {
      const response = NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to resend verification email",
        },
        { status: 400 },
      )

      // Still include rate limit headers even on failure
      response.headers.set(
        "X-RateLimit-Remaining",
        rateLimitResult.remaining.toString(),
      )
      response.headers.set(
        "X-RateLimit-Reset",
        rateLimitResult.resetTime.toISOString(),
      )

      return response
    }

    const response = NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    })

    // Add rate limit headers
    response.headers.set(
      "X-RateLimit-Remaining",
      rateLimitResult.remaining.toString(),
    )
    response.headers.set(
      "X-RateLimit-Reset",
      rateLimitResult.resetTime.toISOString(),
    )

    return response
  } catch (error) {
    console.error("[ResendVerification] Unexpected error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}
