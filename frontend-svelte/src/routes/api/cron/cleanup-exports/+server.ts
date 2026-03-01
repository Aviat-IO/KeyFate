import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { logger } from "$lib/logger"
import { authorizeRequest } from "$lib/cron/utils"
import { getDatabase } from "$lib/db/drizzle"
import { dataExportJobs } from "$lib/db/schema"
import { lt, eq } from "drizzle-orm"
import { deleteExportFile } from "$lib/gdpr/export-service"

export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }
  return json({ status: "ok", job: "cleanup-exports" })
}

export const POST: RequestHandler = async (event) => {
  try {
    if (!authorizeRequest(event.request, event.url)) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    logger.info("Cleaning up expired exports")

    const db = await getDatabase()

    const expiredJobs = await db
      .select()
      .from(dataExportJobs)
      .where(lt(dataExportJobs.expiresAt, new Date()))

    if (expiredJobs.length === 0) {
      logger.info("No expired exports found")
      return json({
        success: true,
        cleaned: 0,
        message: "No expired exports",
      })
    }

    logger.info("Found expired exports", { count: expiredJobs.length })

    let deletedCount = 0
    let errorCount = 0

    for (const job of expiredJobs) {
      try {
        if (job.fileUrl) {
          await deleteExportFile(job.fileUrl)
          logger.info("Deleted export file", { jobId: job.id })
        }

        await db.delete(dataExportJobs).where(eq(dataExportJobs.id, job.id))

        deletedCount++
        logger.info("Cleaned up export job", { jobId: job.id })
      } catch (error) {
        logger.error("Error cleaning up export job", error instanceof Error ? error : undefined, { jobId: job.id })
        errorCount++
      }
    }

    logger.info("Cleanup complete", { deletedCount, errorCount })

    return json({
      success: true,
      cleaned: deletedCount,
      errors: errorCount,
    })
  } catch (error) {
    logger.error("Error in cleanup-exports", error instanceof Error ? error : undefined)
    return json(
      { error: "Failed to cleanup exports" },
      { status: 500 },
    )
  }
}
