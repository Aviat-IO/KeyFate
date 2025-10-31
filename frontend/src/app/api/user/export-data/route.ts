import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import {
  hasRecentExportRequest,
  createPendingExportJob,
} from "@/lib/gdpr/export-service"
import { getDatabase } from "@/lib/db/get-database"
import { auditLogs } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

/**
 * POST /api/user/export-data
 * Create a new data export request
 */
export async function POST() {
  try {
    const session = (await getServerSession(
      authConfig,
    )) as Session | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Check if user email is verified
    if (!session.user.email) {
      return NextResponse.json(
        { error: "Email verification required" },
        { status: 403 },
      )
    }

    // Check for recent export request (rate limiting)
    const hasRecent = await hasRecentExportRequest(userId)
    if (hasRecent) {
      return NextResponse.json(
        {
          error: "You can only request one export every 24 hours",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      )
    }

    // Create pending export job
    const job = await createPendingExportJob(userId)

    // Log audit event
    const db = await getDatabase()
    await db.insert(auditLogs).values({
      userId,
      eventType: "data_export_requested",
      eventCategory: "settings",
      details: {
        jobId: job.id,
      },
    })

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message:
        "Export request received. You will receive an email when your export is ready.",
    })
  } catch (error) {
    console.error("Error in POST /api/user/export-data:", error)
    return NextResponse.json(
      { error: "Failed to create export request" },
      { status: 500 },
    )
  }
}
