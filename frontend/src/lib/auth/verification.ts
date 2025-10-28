import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth-config"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"

export async function requireEmailVerification() {
  const session = (await getServerSession(authConfig)) as Session | null

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as Session["user"] & {
    emailVerified?: Date | null
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error: "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
      },
      { status: 403 },
    )
  }

  return null
}

export async function getVerifiedSession() {
  const session = (await getServerSession(authConfig)) as Session | null

  if (!session?.user) {
    return null
  }

  const user = session.user as Session["user"] & {
    emailVerified?: Date | null
  }

  if (!user.emailVerified) {
    return null
  }

  return session
}
