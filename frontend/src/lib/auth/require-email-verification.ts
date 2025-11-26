import { ensureUserExists } from "@/lib/auth/user-verification"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

/**
 * Ensures user exists in database and has verified email.
 *
 * This function consolidates two operations:
 * 1. Creates DB record for OAuth users who don't have one yet
 * 2. Checks that email is verified before allowing protected operations
 *
 * @param session - NextAuth session
 * @returns NextResponse error or null if verification passes
 */
export async function requireEmailVerification(
  session: Session | null,
): Promise<NextResponse | null> {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // First ensure user exists in database (creates if missing for OAuth users)
    const userVerification = await ensureUserExists(session)
    const user = userVerification.user

    if (!user) {
      logger.error("User verification returned no user", undefined, {
        userId: session.user.id,
        exists: userVerification.exists,
        created: userVerification.created,
      })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (userVerification.created) {
      logger.info("Created new user record during email verification check", {
        userId: session.user.id,
        email: user.email,
      })
    }

    if (!user.emailVerified) {
      logger.warn("Email verification required", {
        userId: session.user.id,
      })

      return NextResponse.json(
        {
          error: "Email verification required",
          code: "EMAIL_NOT_VERIFIED",
          message:
            "Please verify your email address before accessing this resource",
        },
        { status: 403 },
      )
    }

    return null
  } catch (error) {
    logger.error("Email verification check failed", error as Error, {
      userId: session.user.id,
    })

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
