import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authConfig } from "@/lib/auth-config"
import {
  recordPrivacyPolicyAcceptance,
  getIpAddress,
} from "@/lib/auth/privacy-policy"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = (await getServerSession(authConfig)) as Session | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ipAddress = getIpAddress(request.headers)
    const result = await recordPrivacyPolicyAcceptance(
      session.user.id,
      ipAddress,
    )

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to record acceptance" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Privacy policy acceptance error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
