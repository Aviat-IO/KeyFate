import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { checkRateLimit } from "$lib/auth/rate-limiting"
import { getDatabase } from "$lib/db/drizzle"
import { users, verificationTokens } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  token: z.string().min(1, "Token is required"),
})

export const POST: RequestHandler = async (event) => {
  try {
    const db = await getDatabase()
    const body = await event.request.json()

    // Validate request body
    const validation = verifyEmailSchema.safeParse(body)
    if (!validation.success) {
      return json(
        {
          success: false,
          error: "Email and token are required",
          details: validation.error.issues,
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
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many verification attempts. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.retryAfter?.toString() || "300",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toISOString(),
          },
        },
      )
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
      return json(
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

      return json(
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
      return json(
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

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          message: "Email is already verified",
          user: {
            id: user.id,
            email: user.email,
          },
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

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        user: {
          id: user.id,
          email: user.email,
        },
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
    console.error("[VerifyEmail] Unexpected error:", error)

    return json(
      {
        success: false,
        error: "An unexpected error occurred during verification",
      },
      { status: 500 },
    )
  }
}
