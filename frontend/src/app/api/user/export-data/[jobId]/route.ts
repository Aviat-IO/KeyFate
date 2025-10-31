import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { getExportJob, incrementDownloadCount } from "@/lib/gdpr/export-service"
import { getDatabase } from "@/lib/db/get-database"
import { auditLogs } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

const MAX_DOWNLOADS = 3

/**
 * GET /api/user/export-data/[jobId]
 * Get export job status and download URL
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const params = await context.params
  try {
    const session = (await getServerSession(
      authConfig,
    )) as Session | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { jobId } = params

    // Get export job
    const job = await getExportJob(jobId)

    if (!job) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 })
    }

    // Check authorization
    if (job.userId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to access this export" },
        { status: 403 },
      )
    }

    // Check if expired
    if (new Date() > job.expiresAt) {
      return NextResponse.json(
        { error: "Export link has expired", code: "EXPIRED" },
        { status: 410 },
      )
    }

    // Check download limit
    if (job.downloadCount >= MAX_DOWNLOADS) {
      return NextResponse.json(
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

      return NextResponse.json({
        status: job.status,
        fileUrl: job.fileUrl,
        fileSize: job.fileSize,
        downloadCount: job.downloadCount + 1,
        expiresAt: job.expiresAt,
        createdAt: job.createdAt,
      })
    }

    // Return status for pending/processing/failed
    return NextResponse.json({
      status: job.status,
      createdAt: job.createdAt,
      errorMessage: job.errorMessage,
    })
  } catch (error) {
    console.error("Error in GET /api/user/export-data/[jobId]:", error)
    return NextResponse.json(
      { error: "Failed to retrieve export" },
      { status: 500 },
    )
  }
}
