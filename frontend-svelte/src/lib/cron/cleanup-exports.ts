/**
 * Core logic for the cleanup-exports cron job.
 *
 * Finds expired data export jobs, deletes their files from storage,
 * and removes the job records from the database.
 */

import { getDatabase } from "$lib/db/get-database"
import { dataExportJobs } from "$lib/db/schema"
import { lt, eq } from "drizzle-orm"
import { logger } from "$lib/logger"
import { deleteExportFile } from "$lib/gdpr/export-service"

export interface CleanupExportsResult {
  success: boolean
  cleaned: number
  errors: number
  message?: string
}

export async function runCleanupExports(): Promise<CleanupExportsResult> {
  logger.info("Cleaning up expired exports")

  const db = await getDatabase()

  const expiredJobs = await db
    .select()
    .from(dataExportJobs)
    .where(lt(dataExportJobs.expiresAt, new Date()))

  if (expiredJobs.length === 0) {
    logger.info("No expired exports found")
    return {
      success: true,
      cleaned: 0,
      errors: 0,
      message: "No expired exports",
    }
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

  return {
    success: true,
    cleaned: deletedCount,
    errors: errorCount,
  }
}
