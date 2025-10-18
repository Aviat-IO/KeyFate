import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/auth/rate-limiting"
import {
  validatePasswordResetToken,
  deletePasswordResetToken,
} from "@/lib/auth/password-reset"
import { validatePassword, hashPassword } from "@/lib/auth/password"
import { getDatabase } from "@/lib/db/drizzle"
import { users, sessions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 },
      )
    }

    const rateLimit = await checkRateLimit("reset-password-attempt", token)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset attempts. Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
        },
        { status: 429 },
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 },
      )
    }

    const tokenValidation = await validatePasswordResetToken(token)
    if (!tokenValidation.isValid) {
      return NextResponse.json(
        { error: tokenValidation.error || "Invalid or expired token" },
        { status: 400 },
      )
    }

    const hashedPassword = await hashPassword(password)
    const db = await getDatabase()

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() } as any)
      .where(eq(users.id, tokenValidation.userId!))

    await deletePasswordResetToken(token)

    await db
      .delete(sessions)
      .where(eq(sessions.userId, tokenValidation.userId!))

    return NextResponse.json(
      { success: true, message: "Password reset successfully" },
      { status: 200 },
    )
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 },
    )
  }
}
