import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authConfig } from "@/lib/auth-config"
import { hasAcceptedPrivacyPolicy } from "@/lib/auth/privacy-policy"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = (await getServerSession(authConfig)) as Session | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accepted = await hasAcceptedPrivacyPolicy(session.user.id)

    return NextResponse.json({ accepted })
  } catch (error) {
    console.error("Privacy policy check error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
