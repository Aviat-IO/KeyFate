import { authConfig } from "@/lib/auth-config"
import { subscriptionService } from "@/lib/services/subscription-service"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    const session = (await getServerSession(
      authConfig as any,
    )) as Session | null
    const user = session?.user

    if (!user || !(user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (user as any).id

    const result = await subscriptionService.scheduleDowngrade(userId)

    return NextResponse.json({
      success: true,
      scheduledDowngradeAt: result.scheduledDowngradeAt,
    })
  } catch (error) {
    console.error("Error scheduling downgrade:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    if (errorMessage.includes("No active subscription")) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    if (
      errorMessage.includes("already scheduled") ||
      errorMessage.includes("Cannot schedule")
    ) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to schedule downgrade" },
      { status: 500 },
    )
  }
}
