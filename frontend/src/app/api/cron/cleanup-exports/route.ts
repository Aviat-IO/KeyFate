import { NextRequest, NextResponse } from "next/server"
import { authorizeRequest } from "@/lib/cron/utils"
import { getDatabase } from "@/lib/db/get-database"
import { dataExportJobs } from "@/lib/db/schema"
import { lt, eq } from "drizzle-orm"
import { Storage } from "@google-cloud/storage"

export const dynamic = "force-dynamic"

const storage = new Storage()
const EXPORT_BUCKET = process.env.EXPORT_BUCKET || "keyfate-exports-dev"

/**
 * GET /api/cron/cleanup-exports
 * Health check endpoint for monitoring
 */
export async function GET(request: NextRequest) {
  if (!authorizeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ status: "ok", job: "cleanup-exports" })
}

/**
 * POST /api/cron/cleanup-exports
 * Clean up expired export files from storage and database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    if (!authorizeRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CRON] Cleaning up expired exports...")

    const db = await getDatabase()

    // Find expired export jobs
    const expiredJobs = await db
      .select()
      .from(dataExportJobs)
      .where(lt(dataExportJobs.expiresAt, new Date()))

    if (expiredJobs.length === 0) {
      console.log("[CRON] No expired exports found")
      return NextResponse.json({
        success: true,
        cleaned: 0,
        message: "No expired exports",
      })
    }

    console.log(`[CRON] Found ${expiredJobs.length} expired exports`)

    let deletedCount = 0
    let errorCount = 0

    // Delete files from Cloud Storage and database records
    for (const job of expiredJobs) {
      try {
        // Extract file path from signed URL
        if (job.fileUrl) {
          const url = new URL(job.fileUrl)
          const filePath = url.pathname.split(`/${EXPORT_BUCKET}/`)[1]

          if (filePath) {
            const file = storage.bucket(EXPORT_BUCKET).file(filePath)
            await file.delete().catch((err) => {
              // Ignore if file doesn't exist
              if (err.code !== 404) throw err
            })
            console.log(`[CRON] Deleted file: ${filePath}`)
          }
        }

        // Delete database record
        await db.delete(dataExportJobs).where(eq(dataExportJobs.id, job.id))

        deletedCount++
        console.log(`[CRON] Cleaned up export job ${job.id}`)
      } catch (error) {
        console.error(`[CRON] Error cleaning up export job ${job.id}:`, error)
        errorCount++
      }
    }

    console.log(
      `[CRON] Cleanup complete: ${deletedCount} deleted, ${errorCount} errors`,
    )

    return NextResponse.json({
      success: true,
      cleaned: deletedCount,
      errors: errorCount,
    })
  } catch (error) {
    console.error("[CRON] Error in cleanup-exports:", error)
    return NextResponse.json(
      { error: "Failed to cleanup exports" },
      { status: 500 },
    )
  }
}
