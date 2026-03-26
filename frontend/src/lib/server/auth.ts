import type { RequestEvent } from "@sveltejs/kit"
import type { Session } from "@auth/sveltekit"

/**
 * Get the current session from a RequestEvent.
 * Use this in API routes (+server.ts) and server load functions.
 *
 * @example
 * ```ts
 * import { getSession } from "$lib/server/auth"
 * import { error } from "@sveltejs/kit"
 *
 * export async function GET(event) {
 *   const session = await getSession(event)
 *   if (!session?.user?.id) throw error(401, "Unauthorized")
 *   // ...
 * }
 * ```
 */
export async function getSession(
  event: RequestEvent,
): Promise<Session | null> {
  return event.locals.auth()
}

/**
 * Require an authenticated session or throw 401.
 * Returns the session with a guaranteed user.id.
 *
 * @example
 * ```ts
 * import { requireSession } from "$lib/server/auth"
 *
 * export async function POST(event) {
 *   const session = await requireSession(event)
 *   const userId = session.user.id
 *   // ...
 * }
 * ```
 */
export async function requireSession(
  event: RequestEvent,
): Promise<Session & { user: { id: string; email?: string | null } }> {
  const session = await getSession(event)

  if (!session?.user?.id) {
    const { error } = await import("@sveltejs/kit")
    throw error(401, "Unauthorized")
  }

  return session as Session & {
    user: { id: string; email?: string | null }
  }
}
