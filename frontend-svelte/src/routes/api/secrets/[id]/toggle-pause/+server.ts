import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { secretsService } from "$lib/db/drizzle"
import { mapDrizzleSecretToApiShape } from "$lib/db/secret-mapper"
import { getSecretWithRecipients } from "$lib/db/queries/secrets"
import {
  scheduleRemindersForSecret,
  cancelRemindersForSecret,
} from "$lib/services/reminder-scheduler"

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

    const secret = await secretsService.getById(id, session.user.id)

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    const newStatus = secret.status === "active" ? "paused" : "active"

    // When unpausing (changing from paused to active), perform a check-in
    let updatePayload: any = { status: newStatus }

    if (newStatus === "active") {
      const now = new Date()
      const nextCheckIn = new Date(
        now.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000,
      )
      updatePayload = {
        ...updatePayload,
        lastCheckIn: now,
        nextCheckIn: nextCheckIn,
      }
    }

    // Update the secret status (and check-in times if unpausing)
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

    if (newStatus === "active" && updatePayload.nextCheckIn) {
      await scheduleRemindersForSecret(
        id,
        updatePayload.nextCheckIn,
        secret.checkInDays,
      )
    } else if (newStatus === "paused") {
      await cancelRemindersForSecret(id)
    }

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
      status: newStatus,
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/toggle-pause:", error)
    return json({ error: "Internal Server Error" }, { status: 500 })
  }
}
