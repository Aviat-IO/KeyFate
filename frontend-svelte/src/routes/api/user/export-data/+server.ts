import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import {
  hasRecentExportRequest,
  createPendingExportJob,
} from "$lib/gdpr/export-service"
import { getDatabase } from "$lib/db/get-database"
import { auditLogs } from "$lib/db/schema"

/**
 * POST /api/user/export-data
 * Create a new data export request
 */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id

    // Check if user email is verified
    if (!session.user.email) {
      return json(
        { error: "Email verification required" },
        { status: 403 },
      )
    }

    // Check for recent export request (rate limiting)
    const hasRecent = await hasRecentExportRequest(userId)
    if (hasRecent) {
      return json(
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

    return json({
      jobId: job.id,
      status: job.status,
      message:
        "Export request received. You will receive an email when your export is ready.",
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in POST /api/user/export-data:", error)
    return json(
      { error: "Failed to create export request" },
      { status: 500 },
    )
  }
}
