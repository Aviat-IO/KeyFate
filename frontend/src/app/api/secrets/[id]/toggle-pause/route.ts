import { authConfig } from "@/lib/auth-config"
import { secretsService } from "@/lib/db/drizzle"
import { mapDrizzleSecretToApiShape } from "@/lib/db/secret-mapper"
import { getSecretWithRecipients } from "@/lib/db/queries/secrets"
import {
  scheduleRemindersForSecret,
  cancelRemindersForSecret,
} from "@/lib/services/reminder-scheduler"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Use NextAuth for authentication
    const session = (await getServerSession(
      authConfig as any,
    )) as Session | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const secret = await secretsService.getById(id, session.user.id)

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 })
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
      return NextResponse.json(
        { error: "Failed to update secret" },
        {
          status: 500,
        },
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
      return NextResponse.json(
        { error: "Secret not found after update" },
        { status: 404 },
      )
    }

    const mapped = mapDrizzleSecretToApiShape(updatedSecretWithRecipients)
    return NextResponse.json({
      success: true,
      secret: mapped,
      status: newStatus,
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/toggle-pause:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
