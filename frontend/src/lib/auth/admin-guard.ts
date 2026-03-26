import { error, redirect } from "@sveltejs/kit"
import type { Session } from "@auth/core/types"

export interface AdminSession extends Session {
  user: Session["user"] & {
    id: string
    isAdmin: boolean
  }
}

/**
 * Require that the current session belongs to an admin user.
 * Redirects to sign-in if no session, throws 403 if not admin.
 */
export function requireAdmin(session: Session | null): asserts session is AdminSession {
  if (!session?.user) {
    redirect(303, "/sign-in")
  }

  if (!(session.user as any).isAdmin) {
    error(403, "Forbidden")
  }
}
