import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { ensureUserExists } from "$lib/auth/user-verification"
import { getDatabase } from "$lib/db/drizzle"
import { checkinHistory, secrets } from "$lib/db/schema"
import { and, eq } from "drizzle-orm"
import { mapDrizzleSecretToApiShape } from "$lib/db/secret-mapper"
import { getSecretWithRecipients } from "$lib/db/queries/secrets"
import { logCheckIn } from "$lib/services/audit-logger"
import { scheduleRemindersForSecret } from "$lib/services/reminder-scheduler"

export const POST: RequestHandler = async (event) => {
  try {
    const id = event.params.id

    const csrfCheck = await requireCSRFProtection(event)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure user exists in database before creating check-in history
    try {
      const userVerification = await ensureUserExists(session as any)
      console.log("[Check-in API] User verification result:", {
        exists: userVerification.exists,
        created: userVerification.created,
        userId: session.user.id,
      })
    } catch (userError) {
      console.error("[Check-in API] User verification failed:", userError)
      return json(
        { error: "Failed to verify user account" },
        { status: 500 },
      )
    }

    const userId = session.user.id

    const database = await getDatabase()

    // Use transaction with SELECT FOR UPDATE to prevent TOCTOU race
    const result = await database.transaction(async (tx) => {
      // Lock the secret row to prevent concurrent check-ins
      const [secret] = await tx
        .select()
        .from(secrets)
        .where(and(eq(secrets.id, id), eq(secrets.userId, userId)))
        .for("update")

      if (!secret) {
        return null
      }

      const now = new Date()
      const nextCheckIn = new Date(
        now.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000,
      )

      // Build update payload — reset failure fields if recovering from failed status
      const updatePayload: Record<string, unknown> = {
        lastCheckIn: now,
        nextCheckIn,
        updatedAt: now,
      }

      if (secret.status === "failed") {
        updatePayload.status = "active"
        updatePayload.retryCount = 0
        updatePayload.lastRetryAt = null
        updatePayload.lastError = null
      }

      // Update the secret with new check-in times
      const [updatedSecret] = await tx
        .update(secrets)
        .set(updatePayload)
        .where(and(eq(secrets.id, id), eq(secrets.userId, userId)))
        .returning()

      // Record check-in history
      await tx.insert(checkinHistory).values({
        secretId: id,
        userId,
        checkedInAt: now,
        nextCheckIn: nextCheckIn,
      })

      return { secret: updatedSecret, nextCheckIn, checkInDays: secret.checkInDays }
    })

    if (!result) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    // Non-critical side effects outside the transaction
    await logCheckIn(session.user.id, id, {
      nextCheckIn: result.nextCheckIn.toISOString(),
      checkInDays: result.checkInDays,
    }, event)

    await scheduleRemindersForSecret(id, result.nextCheckIn, result.checkInDays)

    // Get the updated secret with recipients
    const updatedSecretWithRecipients = await getSecretWithRecipients(
      id,
      session.user.id,
    )
    if (!updatedSecretWithRecipients) {
      return json(
        { error: "Secret not found after update" },
        { status: 404 },
      )
    }

    const mapped = mapDrizzleSecretToApiShape(updatedSecretWithRecipients)
    return json({
      success: true,
      secret: mapped,
      next_check_in: mapped.next_check_in,
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/check-in:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
