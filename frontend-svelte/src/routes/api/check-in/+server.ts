import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getDatabase } from "$lib/db/drizzle"
import { checkInTokens, secrets, checkinHistory } from "$lib/db/schema"
import { scheduleRemindersForSecret } from "$lib/services/reminder-scheduler"
import {
  checkRateLimit,
  getRateLimitHeaders,
  getClientIdentifier,
} from "$lib/rate-limit"
import { eq } from "drizzle-orm"

/**
 * GET /api/check-in
 *
 * Debug/info endpoint for check-in status.
 * No auth required.
 */
export const GET: RequestHandler = async (event) => {
  const token = event.url.searchParams.get("token")

  return json(
    {
      message: "Check-in endpoint is active. Use POST method to check in.",
      hasToken: !!token,
      method: "GET",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}

/**
 * POST /api/check-in
 *
 * Token-based check-in endpoint. No session auth required.
 * Uses check-in tokens for authentication.
 */
export const POST: RequestHandler = async (event) => {
  const startTime = Date.now()

  try {
    // Validate environment
    if (!process.env.DATABASE_URL) {
      console.error("[CHECK-IN] DATABASE_URL not configured")
      return json(
        { error: "Database configuration error" },
        { status: 500 },
      )
    }

    const db = await getDatabase()
    const token = event.url.searchParams.get("token")

    // Log check-in attempt (security monitoring)
    console.log("[CHECK-IN] Attempt received", {
      timestamp: new Date().toISOString(),
      hasToken: !!token,
      ip:
        event.request.headers.get("x-forwarded-for") ||
        event.request.headers.get("x-real-ip") ||
        "unknown",
      method: event.request.method,
      url: event.url.toString(),
    })

    if (!token) {
      console.warn("[CHECK-IN] Missing token parameter")
      return json(
        { error: "Missing token" },
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const clientIp = getClientIdentifier(event.request)
    const rateLimitResult = await checkRateLimit("checkIn", clientIp, 10)
    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: "Too many check-in attempts. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...getRateLimitHeaders(rateLimitResult),
          },
        },
      )
    }

    const [tokenRow] = await db
      .select()
      .from(checkInTokens)
      .where(eq(checkInTokens.token, token))
      .limit(1)

    if (!tokenRow) {
      // Use constant-time delay to prevent timing attacks
      const elapsed = Date.now() - startTime
      if (elapsed < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100 - elapsed))
      }

      console.warn("[CHECK-IN] Invalid token attempt", {
        timestamp: new Date().toISOString(),
        tokenPrefix: token.substring(0, 8) + "...",
      })

      return json(
        { error: "Invalid or expired token" },
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (tokenRow.usedAt) {
      console.warn("[CHECK-IN] Token reuse attempt", {
        timestamp: new Date().toISOString(),
        tokenId: tokenRow.id,
        secretId: tokenRow.secretId,
        originalUse: tokenRow.usedAt.toISOString(),
      })

      return json(
        { error: "Token has already been used" },
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (new Date(tokenRow.expiresAt) < new Date()) {
      console.warn("[CHECK-IN] Expired token attempt", {
        timestamp: new Date().toISOString(),
        tokenId: tokenRow.id,
        secretId: tokenRow.secretId,
        expiresAt: tokenRow.expiresAt.toISOString(),
      })

      return json(
        { error: "Token has expired" },
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const [secret] = await db
      .select({
        id: secrets.id,
        userId: secrets.userId,
        title: secrets.title,
        checkInDays: secrets.checkInDays,
        triggeredAt: secrets.triggeredAt,
        status: secrets.status,
      })
      .from(secrets)
      .where(eq(secrets.id, tokenRow.secretId))
      .limit(1)

    if (!secret) {
      return json(
        { error: "Secret not found" },
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (secret.triggeredAt || secret.status === "triggered") {
      console.warn("[CHECK-IN] Attempt to check in on triggered secret", {
        timestamp: new Date().toISOString(),
        tokenId: tokenRow.id,
        secretId: secret.id,
        secretTitle: secret.title,
        triggeredAt: secret.triggeredAt?.toISOString(),
      })

      return json(
        {
          error:
            "This secret has already been triggered and can no longer be checked in. The secret was disclosed to the recipient.",
        },
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (!secret.checkInDays) {
      console.error("[CHECK-IN] Secret missing checkInDays", {
        secretId: secret.id,
        secretTitle: secret.title,
      })
      return json(
        { error: "Secret configuration error: missing check-in interval" },
        { status: 500 },
      )
    }

    // Calculate next check-in using milliseconds to avoid DST issues
    const now = new Date()
    const nextCheckIn = new Date(
      now.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000,
    )

    await db
      .update(checkInTokens)
      .set({ usedAt: now } as any)
      .where(eq(checkInTokens.id, tokenRow.id))

    await db
      .update(secrets)
      .set({ lastCheckIn: now, nextCheckIn } as any)
      .where(eq(secrets.id, tokenRow.secretId))

    await db.insert(checkinHistory).values({
      secretId: tokenRow.secretId,
      userId: secret.userId,
      checkedInAt: now,
      nextCheckIn: nextCheckIn,
    })

    await scheduleRemindersForSecret(
      tokenRow.secretId,
      nextCheckIn,
      secret.checkInDays,
    )

    // Log successful check-in for security monitoring
    console.log("[CHECK-IN] Success", {
      timestamp: new Date().toISOString(),
      tokenId: tokenRow.id,
      secretId: secret.id,
      secretTitle: secret.title,
      nextCheckIn: nextCheckIn.toISOString(),
      processingTime: Date.now() - startTime + "ms",
    })

    return json(
      {
        success: true,
        secretTitle: secret.title,
        nextCheckIn: nextCheckIn.toISOString(),
        message: `Your secret "${secret.title}" timer has been reset.`,
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("[CHECK-IN] Error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    return json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
