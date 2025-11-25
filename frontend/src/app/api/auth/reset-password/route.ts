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
import { APIError, handleAPIError } from "@/lib/errors/api-error"
import {
  invalidateAllUserSessions,
  SessionInvalidationReason,
} from "@/lib/auth/session-management"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      throw APIError.validation("Token and password are required")
    }

    const rateLimit = await checkRateLimit("reset-password-attempt", token)
    if (!rateLimit.allowed) {
      throw APIError.rateLimit(
        `Too many password reset attempts. Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
        rateLimit.retryAfter,
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      throw APIError.validation(passwordValidation.message)
    }

    const tokenValidation = await validatePasswordResetToken(token)
    if (!tokenValidation.isValid) {
      throw APIError.validation(
        tokenValidation.error || "Invalid or expired token",
      )
    }

    const hashedPassword = await hashPassword(password)
    const db = await getDatabase()

    // Update password
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() } as any)
      .where(eq(users.id, tokenValidation.userId!))

    // Delete used token
    await deletePasswordResetToken(token)

    // Invalidate all sessions (logout from all devices)
    await invalidateAllUserSessions(
      tokenValidation.userId!,
      SessionInvalidationReason.PASSWORD_CHANGE,
    )

    // Also delete session records
    await db
      .delete(sessions)
      .where(eq(sessions.userId, tokenValidation.userId!))

    logger.info("Password reset successful", {
      userId: tokenValidation.userId,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message:
        "Password reset successfully. Please sign in with your new password.",
    })
  } catch (error) {
    return handleAPIError(error)
  }
}
