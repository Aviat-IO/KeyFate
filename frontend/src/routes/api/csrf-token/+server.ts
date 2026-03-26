import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { generateCSRFToken } from "$lib/csrf"

/**
 * GET /api/csrf-token
 *
 * Generate a CSRF token for the authenticated user.
 * Note: SvelteKit has built-in CSRF protection, but this endpoint
 * is ported for backward compatibility with existing clients.
 */
export const GET: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()

    if (!session?.user) {
      return json(
        { error: "Authentication required" },
        { status: 401 },
      )
    }

    const userId = (session.user as any).id
    if (!userId) {
      return json({ error: "Invalid session" }, { status: 401 })
    }

    const token = await generateCSRFToken(userId)

    return json({
      token,
      expiresIn: 3600, // 1 hour in seconds
    })
  } catch (error) {
    console.error("Error generating CSRF token:", error)
    return json(
      { error: "Failed to generate CSRF token" },
      { status: 500 },
    )
  }
}
