import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth-config"
import { getDatabase } from "@/lib/db/drizzle"
import { csrfTokens } from "@/lib/db/schema"
import { and, eq, gt } from "drizzle-orm"
import crypto from "crypto"

export async function generateCSRFToken(sessionId: string): Promise<string> {
  const db = await getDatabase()
  const token = crypto.randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.insert(csrfTokens).values({
    sessionId,
    token,
    expiresAt,
  })

  return token
}

export async function validateCSRFToken(
  sessionId: string,
  token: string,
): Promise<boolean> {
  const db = await getDatabase()

  const stored = await db
    .select()
    .from(csrfTokens)
    .where(
      and(
        eq(csrfTokens.sessionId, sessionId),
        eq(csrfTokens.token, token),
        gt(csrfTokens.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!stored.length) {
    return false
  }

  // Delete token after use (one-time use)
  await db.delete(csrfTokens).where(eq(csrfTokens.id, stored[0].id))

  return true
}

export async function requireCSRFProtection(
  request: NextRequest,
): Promise<{ valid: boolean; error?: string }> {
  const session = await getServerSession(authConfig)
  if (!session) {
    return { valid: false, error: "Authentication required" }
  }

  // 1. Origin validation
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  if (!origin || origin === "null") {
    return { valid: false, error: "Missing or invalid origin header" }
  }

  const originHost = new URL(origin).host
  if (originHost !== host) {
    return {
      valid: false,
      error: "Origin mismatch - potential CSRF attack",
    }
  }

  // 2. CSRF token validation
  const csrfToken = request.headers.get("x-csrf-token")
  if (!csrfToken) {
    return { valid: false, error: "Missing CSRF token" }
  }

  const userId = (session.user as any)?.id
  if (!userId) {
    return { valid: false, error: "Invalid session" }
  }

  const tokenValid = await validateCSRFToken(userId, csrfToken)
  if (!tokenValid) {
    return { valid: false, error: "Invalid or expired CSRF token" }
  }

  return { valid: true }
}

export function createCSRFErrorResponse() {
  return new Response(
    JSON.stringify({
      error: "CSRF validation failed",
      message: "Request origin validation failed",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  )
}
