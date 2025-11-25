/**
 * Session Revocation API
 *
 * Allows users to revoke all their active sessions
 * (logout from all devices)
 */

import { authConfig } from "@/lib/auth-config"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { APIError, handleAPIError } from "@/lib/errors/api-error"
import {
  invalidateAllUserSessions,
  SessionInvalidationReason,
} from "@/lib/auth/session-management"
import type { Session } from "next-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/revoke-sessions
 *
 * Revoke all active sessions for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const session = (await getServerSession(authConfig)) as Session | null

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

    return NextResponse.json({
      success: true,
      message: "All sessions have been revoked. Please sign in again.",
      sessionsRevoked: result.sessionsInvalidated,
    })
  } catch (error) {
    return handleAPIError(error)
  }
}
