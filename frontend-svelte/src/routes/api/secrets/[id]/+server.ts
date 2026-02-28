import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireEmailVerification } from "$lib/auth/require-email-verification"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { getDatabase, secretsService } from "$lib/db/drizzle"
import {
  checkinHistory,
  checkInTokens,
  emailNotifications,
  reminderJobs,
  secrets as secretsTable,
  secretRecipients,
} from "$lib/db/schema"
import { logSecretDeleted, logSecretEdited } from "$lib/services/audit-logger"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import {
  getSecretWithRecipients,
  updateSecretRecipients,
} from "$lib/db/queries/secrets"

export const GET: RequestHandler = async (event) => {
  try {
    const id = event.params.id

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const secret = await getSecretWithRecipients(id, session.user.id)

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    return json(secret)
  } catch (error) {
    console.error("Error fetching secret:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

// Schema for updating secret metadata
const recipientSchema = z.object({
  name: z.string().min(1, "Recipient name is required"),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
})

const updateSecretSchema = z.object({
  title: z.string().min(1, "Title is required"),
  recipients: z
    .array(recipientSchema)
    .min(1, "At least one recipient is required"),
  check_in_days: z.number().min(1).max(365),
})

export const PUT: RequestHandler = async (event) => {
  try {
    const id = event.params.id

    const csrfCheck = await requireCSRFProtection(event.request as any)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const emailVerificationError = await requireEmailVerification(session as any)
    if (emailVerificationError) {
      return emailVerificationError
    }

    const body = await event.request.json()
    const validatedData = updateSecretSchema.parse(body)

    // Validate that each recipient has either email or phone
    const invalidRecipients = validatedData.recipients.filter(
      (r) => !r.email && !r.phone,
    )
    if (invalidRecipients.length > 0) {
      return json(
        { error: "Each recipient must have either an email or phone number" },
        { status: 400 },
      )
    }

    const existingSecret = await secretsService.getById(id, session.user.id)
    if (!existingSecret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    const checkInDaysChanged =
      existingSecret.checkInDays !== validatedData.check_in_days

    const updateData = {
      title: validatedData.title,
      checkInDays: validatedData.check_in_days,
    }

    const secret = await secretsService.update(id, session.user.id, updateData)

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    await updateSecretRecipients(
      id,
      validatedData.recipients as Array<{
        name: string
        email?: string | null
        phone?: string | null
      }>,
    )

    if (checkInDaysChanged) {
      const now = new Date()
      const nextCheckIn = new Date(
        now.getTime() + validatedData.check_in_days * 24 * 60 * 60 * 1000,
      )

      await secretsService.update(id, session.user.id, {
        lastCheckIn: now,
        nextCheckIn,
      })

      const db = await getDatabase()
      await db.insert(checkinHistory).values({
        secretId: id,
        userId: session.user.id,
        checkedInAt: now,
        nextCheckIn: nextCheckIn,
      })
    }

    await logSecretEdited(session.user.id, id, {
      title: validatedData.title,
      recipientCount: validatedData.recipients.length,
      checkInDays: validatedData.check_in_days,
    })

    const updatedSecret = await getSecretWithRecipients(id, session.user.id)
    return json(updatedSecret)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        { error: "Invalid data", details: error.issues },
        { status: 400 },
      )
    }

    console.error("Error updating secret:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

export const DELETE: RequestHandler = async (event) => {
  try {
    const id = event.params.id

    const csrfCheck = await requireCSRFProtection(event.request as any)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // First verify the secret exists and belongs to the user
    const secret = await secretsService.getById(id, userId)

    if (!secret) {
      return json({ error: "Secret not found" }, { status: 404 })
    }

    // Cascade delete related records inside a transaction
    const db = await getDatabase()

    await db.transaction(async (tx) => {
      await tx.delete(checkinHistory).where(eq(checkinHistory.secretId, id))
      await tx.delete(checkInTokens).where(eq(checkInTokens.secretId, id))
      await tx.delete(reminderJobs).where(eq(reminderJobs.secretId, id))
      await tx
        .delete(emailNotifications)
        .where(eq(emailNotifications.secretId, id))
      await tx.delete(secretRecipients).where(eq(secretRecipients.secretId, id))
      await tx
        .delete(secretsTable)
        .where(
          and(
            eq(secretsTable.id, id),
            eq(secretsTable.userId, userId),
          ),
        )
    })

    await logSecretDeleted(userId, id, {
      title: secret.title,
    })

    return json({ success: true })
  } catch (error) {
    console.error("Error deleting secret:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
