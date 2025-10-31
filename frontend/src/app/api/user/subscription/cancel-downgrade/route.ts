import { authConfig } from "@/lib/auth-config"
import { subscriptionService } from "@/lib/services/subscription-service"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    const session = (await getServerSession(
      authConfig,
    )) as Session | null
    const user = session?.user

    if (!user || !(user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (user as any).id

    const result = await subscriptionService.cancelScheduledDowngrade(userId)

    return NextResponse.json({
      success: true,
      subscription: result,
    })
  } catch (error) {
    console.error("Error canceling scheduled downgrade:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    if (errorMessage.includes("No subscription")) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    if (errorMessage.includes("No scheduled downgrade")) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to cancel scheduled downgrade" },
      { status: 500 },
    )
  }
}
