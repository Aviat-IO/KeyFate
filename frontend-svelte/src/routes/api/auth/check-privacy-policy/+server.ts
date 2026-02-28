import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { hasAcceptedPrivacyPolicy } from "$lib/auth/privacy-policy"

export const GET: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()

    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const accepted = await hasAcceptedPrivacyPolicy(session.user.id)

    return json({ accepted })
  } catch (error) {
    console.error("Privacy policy check error:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
