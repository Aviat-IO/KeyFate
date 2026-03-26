import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { getUserTierInfo } from "$lib/subscription"

export const GET: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const tierInfo = await getUserTierInfo(session.user.id)

    if (!tierInfo) {
      return json(
        { error: "Failed to retrieve tier information" },
        { status: 500 },
      )
    }

    return json({
      tier: tierInfo.tier.tiers.name,
      displayName: tierInfo.tier.tiers.display_name,
      limits: {
        maxSecrets: tierInfo.tier.tiers.max_secrets,
        maxRecipientsPerSecret: tierInfo.tier.tiers.max_recipients_per_secret,
        customIntervals: tierInfo.tier.tiers.custom_intervals,
      },
      usage: {
        secretsCount: tierInfo.usage.secrets_count,
        totalRecipients: tierInfo.usage.total_recipients,
      },
      canCreate: tierInfo.limits.secrets.canCreate,
      subscription: tierInfo.subscription
        ? {
            status: tierInfo.subscription.status,
            currentPeriodEnd: tierInfo.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: tierInfo.subscription.cancelAtPeriodEnd,
          }
        : null,
    })
  } catch (error) {
    // requireSession throws 401 HttpError — let SvelteKit handle it
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in GET /api/user/tier:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
