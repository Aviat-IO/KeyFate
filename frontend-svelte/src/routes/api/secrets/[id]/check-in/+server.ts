import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { ensureUserExists } from "$lib/auth/user-verification"
import { getDatabase, secretsService } from "$lib/db/drizzle"
import type { SecretUpdate } from "$lib/db/schema"
import { checkinHistory } from "$lib/db/schema"
import { mapDrizzleSecretToApiShape } from "$lib/db/secret-mapper"
import { getSecretWithRecipients } from "$lib/db/queries/secrets"
import { logCheckIn } from "$lib/services/audit-logger"
import { scheduleRemindersForSecret } from "$lib/services/reminder-scheduler"

export const POST: RequestHandler = async (event) => {
  try {
    const id = event.params.id

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

    const secret = await secretsService.getById(id, session.user.id)

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    // Calculate next check-in using milliseconds to avoid DST issues
    const now = new Date()
    const nextCheckIn = new Date(
      now.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000,
    )

    // Update the secret with new check-in times
    const updatePayload = { lastCheckIn: now, nextCheckIn } as SecretUpdate
    const updatedSecret = await secretsService.update(
      id,
      session.user.id,
      updatePayload,
    )

    if (!updatedSecret) {
      return json(
        { error: "Failed to update secret" },
        { status: 500 },
      )
    }

    // Record check-in history
    const database = await getDatabase()
    await database.insert(checkinHistory).values({
      secretId: id,
      userId: session.user.id,
      checkedInAt: now,
      nextCheckIn: nextCheckIn,
    })

    await logCheckIn(session.user.id, id, {
      nextCheckIn: nextCheckIn.toISOString(),
      checkInDays: secret.checkInDays,
    })

    await scheduleRemindersForSecret(id, nextCheckIn, secret.checkInDays)

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
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error"
    return json({ error: errorMessage }, { status: 500 })
  }
}
