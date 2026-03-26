/**
 * Session Revocation API
 *
 * Allows users to revoke all their active sessions
 * (logout from all devices)
 */

import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { APIError, handleAPIError } from "$lib/errors/api-error"
import {
  invalidateAllUserSessions,
  SessionInvalidationReason,
} from "$lib/auth/session-management"

/**
 * POST /api/auth/revoke-sessions
 *
 * Revoke all active sessions for the authenticated user
 */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()

    if (!session?.user?.id) {
      throw APIError.unauthorized("Authentication required")
    }

    // Invalidate all user sessions
    const result = await invalidateAllUserSessions(
      session.user.id,
      SessionInvalidationReason.USER_REQUEST,
    )

    if (!result.success) {
      throw APIError.internal("Failed to revoke sessions")
    }

    return json({
      success: true,
      message: "All sessions have been revoked. Please sign in again.",
      sessionsRevoked: result.sessionsInvalidated,
    })
  } catch (error) {
    const errorResponse = handleAPIError(error)
    return errorResponse
  }
}
