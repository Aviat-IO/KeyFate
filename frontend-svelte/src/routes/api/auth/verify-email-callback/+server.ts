import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getDatabase } from "$lib/db/drizzle"
import { users, verificationTokens } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import crypto from "crypto"

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid email address"),
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
          error: "Invalid request data",
          details: validation.error.issues,
        },
        { status: 400 },
      )
    }

    const { token, email } = validation.data

    // Verify the token exists and hasn't expired
    const verificationResult = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, token),
        ),
      )
      .limit(1)

    const verificationRecord = verificationResult[0]
    if (!verificationRecord) {
      return json(
        {
          success: false,
          error: "Invalid or expired verification token",
        },
        { status: 400 },
      )
    }

    // Check if token has expired
    if (verificationRecord.expires < new Date()) {
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

    // Update user's email verification status
    const updateResult = await db
      .update(users)
      .set({
        emailVerified: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(users.email, email))
      .returning()

    const updatedUser = updateResult[0]
    if (!updatedUser) {
      return json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      )
    }

    // Remove the used verification token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token))

    console.log(
      `[VerifyEmail] Successfully verified email for user: ${updatedUser.id}`,
    )

    // Generate a verification token for auto-login
    const verificationToken = crypto.randomBytes(32).toString("hex")

    return json({
      success: true,
      verified: true,
      message: "Email successfully verified",
      sessionToken: verificationToken,
      userId: updatedUser.id,
    })
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
