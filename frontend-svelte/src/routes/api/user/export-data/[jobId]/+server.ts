import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { getExportJob, incrementDownloadCount } from "$lib/gdpr/export-service"
import { getDatabase } from "$lib/db/get-database"
import { auditLogs } from "$lib/db/schema"

const MAX_DOWNLOADS = 3

/**
 * GET /api/user/export-data/[jobId]
 * Get export job status and download URL
 */
export const GET: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const userId = session.user.id
    const { jobId } = event.params

    // Get export job
    const job = await getExportJob(jobId)

    if (!job) {
      return json({ error: "Export not found" }, { status: 404 })
    }

    // Check authorization
    if (job.userId !== userId) {
      return json(
        { error: "Not authorized to access this export" },
        { status: 403 },
      )
    }

    // Check if expired
    if (new Date() > job.expiresAt) {
      return json(
        { error: "Export link has expired", code: "EXPIRED" },
        { status: 410 },
      )
    }

    // Check download limit
    if (job.downloadCount >= MAX_DOWNLOADS) {
      return json(
        {
          error: "Download limit reached (maximum 3 downloads)",
          code: "DOWNLOAD_LIMIT",
        },
        { status: 403 },
      )
    }

    // If completed, increment download count and return URL
    if (job.status === "completed" && job.fileUrl) {
      await incrementDownloadCount(jobId)

      // Log audit event
      const db = await getDatabase()
      await db.insert(auditLogs).values({
        userId,
        eventType: "data_export_downloaded",
        eventCategory: "settings",
        details: {
          jobId: job.id,
          downloadCount: job.downloadCount + 1,
        },
      })

      return json({
        status: job.status,
        fileUrl: job.fileUrl,
        fileSize: job.fileSize,
        downloadCount: job.downloadCount + 1,
        expiresAt: job.expiresAt,
        createdAt: job.createdAt,
      })
    }

    // Return status for pending/processing/failed
    return json({
      status: job.status,
      createdAt: job.createdAt,
      errorMessage: job.errorMessage,
    })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in GET /api/user/export-data/[jobId]:", error)
    return json(
      { error: "Failed to retrieve export" },
      { status: 500 },
    )
  }
}
