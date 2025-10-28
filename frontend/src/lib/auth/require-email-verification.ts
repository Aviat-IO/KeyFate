import { getDatabase } from "@/lib/db/drizzle"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function requireEmailVerification(
  session: Session | null,
): Promise<NextResponse | null> {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await getDatabase()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.emailVerified) {
      logger.warn("Email verification required", {
        userId: session.user.id,
        email: session.user.email,
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
