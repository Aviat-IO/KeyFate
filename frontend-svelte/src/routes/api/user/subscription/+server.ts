import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { getUserTierInfo } from "$lib/subscription"

export const GET: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const tierInfo = await getUserTierInfo(session.user.id)

    if (!tierInfo) {
      return json({ tier: { name: "free" } })
    }

    return json({
      tier: {
        name: tierInfo.tier.tiers.name,
        displayName: tierInfo.tier.tiers.display_name,
      },
      subscription: tierInfo.subscription
        ? {
            status: tierInfo.subscription.status,
          }
        : null,
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in GET /api/user/subscription:", error)
    return json({ tier: { name: "free" } })
  }
}
