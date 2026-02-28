import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { authorizeRequest } from "$lib/cron/utils"
import { adaptRequestEvent } from "$lib/cron/adapt-request"
import { getDatabase } from "$lib/db/get-database"
import { dataExportJobs } from "$lib/db/schema"
import { lt, eq } from "drizzle-orm"
import { deleteExportFile } from "$lib/gdpr/export-service"

export const GET: RequestHandler = async (event) => {
  const req = adaptRequestEvent(event)
  if (!authorizeRequest(req)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "cleanup-exports" })
}

export const POST: RequestHandler = async (event) => {
  try {
    const req = adaptRequestEvent(event)
    if (!authorizeRequest(req)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CRON] Cleaning up expired exports...")

    const db = await getDatabase()

    const expiredJobs = await db
      .select()
      .from(dataExportJobs)
      .where(lt(dataExportJobs.expiresAt, new Date()))

    if (expiredJobs.length === 0) {
      console.log("[CRON] No expired exports found")
      return json({
        success: true,
        cleaned: 0,
        message: "No expired exports",
      })
    }

    console.log(`[CRON] Found ${expiredJobs.length} expired exports`)

    let deletedCount = 0
    let errorCount = 0

    for (const job of expiredJobs) {
      try {
        if (job.fileUrl) {
          await deleteExportFile(job.fileUrl)
          console.log(`[CRON] Deleted export file for job ${job.id}`)
        }

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

    return json({
      success: true,
      cleaned: deletedCount,
      errors: errorCount,
    })
  } catch (error) {
    console.error("[CRON] Error in cleanup-exports:", error)
    return json(
      { error: "Failed to cleanup exports" },
      { status: 500 },
    )
  }
}
