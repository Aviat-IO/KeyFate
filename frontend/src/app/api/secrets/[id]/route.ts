import { authConfig } from "@/lib/auth-config"
import { getDatabase, secretsService } from "@/lib/db/drizzle"
import {
  checkinHistory,
  checkInTokens,
  emailNotifications,
  reminderJobs,
  secrets as secretsTable,
  secretRecipients,
} from "@/lib/db/schema"
import { logSecretDeleted, logSecretEdited } from "@/lib/services/audit-logger"
import { and, eq } from "drizzle-orm"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getSecretWithRecipients,
  updateSecretRecipients,
} from "@/lib/db/queries/secrets"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Use NextAuth for authentication
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0]
    const session = (await getServerSession(
      authConfig as GetServerSessionOptions,
    )) as Session | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const secret = await getSecretWithRecipients(id, session.user.id)

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 })
    }

    return NextResponse.json(secret)
  } catch (error) {
    console.error("Error fetching secret:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Use NextAuth for authentication
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0]
    const session = (await getServerSession(
      authConfig as GetServerSessionOptions,
    )) as Session | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateSecretSchema.parse(body)

    // Validate that each recipient has either email or phone
    const invalidRecipients = validatedData.recipients.filter(
      (r) => !r.email && !r.phone,
    )
    if (invalidRecipients.length > 0) {
      return NextResponse.json(
        { error: "Each recipient must have either an email or phone number" },
        { status: 400 },
      )
    }

    // Update secret metadata
    const updateData = {
      title: validatedData.title,
      checkInDays: validatedData.check_in_days,
    }

    const secret = await secretsService.update(id, session.user.id, updateData)

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 })
    }

    // Update recipients - cast to RecipientInput since validation ensures correct shape
    await updateSecretRecipients(
      id,
      validatedData.recipients as Array<{
        name: string
        email?: string | null
        phone?: string | null
      }>,
    )

    await logSecretEdited(session.user.id, id, {
      title: validatedData.title,
      recipientCount: validatedData.recipients.length,
      checkInDays: validatedData.check_in_days,
    })

    // Return updated secret with recipients
    const updatedSecret = await getSecretWithRecipients(id, session.user.id)
    return NextResponse.json(updatedSecret)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 },
      )
    }

    console.error("Error updating secret:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Use NextAuth for authentication
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0]
    const session = (await getServerSession(
      authConfig as GetServerSessionOptions,
    )) as Session | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // First verify the secret exists and belongs to the user
    const secret = await secretsService.getById(id, session.user.id)

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 })
    }

    // Cascade delete related records inside a transaction
    // Get database connection for transaction
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
            eq(secretsTable.userId, session.user.id),
          ),
        )
    })

    await logSecretDeleted(session.user.id, id, {
      title: secret.title,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting secret:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
