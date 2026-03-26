import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import {
  recordPrivacyPolicyAcceptance,
  getIpAddress,
} from "$lib/auth/privacy-policy"

export const POST: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()

    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const ipAddress = getIpAddress(event.request.headers)
    const result = await recordPrivacyPolicyAcceptance(
      session.user.id,
      ipAddress,
    )

    if (!result.success) {
      return json(
        { error: "Failed to record acceptance" },
        { status: 500 },
      )
    }

    return json({ success: true })
  } catch (error) {
    console.error("Privacy policy acceptance error:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
