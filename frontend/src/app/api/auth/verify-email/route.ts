import { checkRateLimit } from "@/lib/auth/rate-limiting"
import { getDatabase } from "@/lib/db/drizzle"
import { users, verificationTokens } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  token: z.string().min(1, "Token is required"),
})

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const body = await request.json()

    // Validate request body
    const validation = verifyEmailSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and token are required",
          details: validation.error.errors,
        },
        { status: 400 },
      )
    }

    const { email, token } = validation.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      "verify-email",
      normalizedEmail,
    )
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Too many verification attempts. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 },
      )

      response.headers.set(
        "Retry-After",
        rateLimitResult.retryAfter?.toString() || "300",
      )
      response.headers.set("X-RateLimit-Remaining", "0")
      response.headers.set(
        "X-RateLimit-Reset",
        rateLimitResult.resetTime.toISOString(),
      )

      return response
    }

    // Look up verification token
    const tokenResult = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, normalizedEmail),
          eq(verificationTokens.token, token),
        ),
      )
      .limit(1)

    const verificationToken = tokenResult[0]
    if (!verificationToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification token",
        },
        { status: 400 },
      )
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token))

      return NextResponse.json(
        {
          success: false,
          error: "Verification token has expired",
        },
        { status: 400 },
      )
    }

    // Look up user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    const user = userResult[0]
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      )
    }

    // Check if user is already verified
    if (user.emailVerified) {
      // Still clean up the token
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token))

      const response = NextResponse.json({
        success: true,
        verified: true,
        message: "Email is already verified",
        user: {
          id: user.id,
          email: user.email,
        },
      })

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

    // Update user as verified and clean up token
    await Promise.all([
      // Mark email as verified
      db
        .update(users)
        .set({
          emailVerified: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, user.id)),

      // Delete the used verification token
      db.delete(verificationTokens).where(eq(verificationTokens.token, token)),
    ])

    console.log(
      `[VerifyEmail] Successfully verified email for user: ${user.id}`,
    )

    const response = NextResponse.json({
      success: true,
      verified: true,
      user: {
        id: user.id,
        email: user.email,
      },
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
    console.error("[VerifyEmail] Unexpected error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred during verification",
      },
      { status: 500 },
    )
  }
}
