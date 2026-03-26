import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { subscriptionService } from "$lib/services/subscription-service"

export const POST: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id

    const result = await subscriptionService.cancelScheduledDowngrade(userId)

    return json({
      success: true,
      subscription: result,
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error canceling scheduled downgrade:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    if (errorMessage.includes("No subscription")) {
      return json({ error: errorMessage }, { status: 404 })
    }

    if (errorMessage.includes("No scheduled downgrade")) {
      return json({ error: errorMessage }, { status: 400 })
    }

    return json(
      { error: "Failed to cancel scheduled downgrade" },
      { status: 500 },
    )
  }
}
