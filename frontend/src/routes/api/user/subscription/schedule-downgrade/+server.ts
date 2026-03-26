import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { subscriptionService } from "$lib/services/subscription-service"

export const POST: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id

    const result = await subscriptionService.scheduleDowngrade(userId)

    return json({
      success: true,
      scheduledDowngradeAt: result.scheduledDowngradeAt,
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error scheduling downgrade:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    if (errorMessage.includes("No active subscription")) {
      return json({ error: errorMessage }, { status: 404 })
    }

    if (
      errorMessage.includes("already scheduled") ||
      errorMessage.includes("Cannot schedule")
    ) {
      return json({ error: errorMessage }, { status: 400 })
    }

    return json({ error: "Failed to schedule downgrade" }, { status: 500 })
  }
}
