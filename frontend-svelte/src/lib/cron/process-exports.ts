/**
 * Core logic for the process-exports cron job.
 *
 * Finds pending data export jobs, generates the export files,
 * uploads them, and sends email notifications.
 */

import { getDatabase } from "$lib/db/get-database"
import { dataExportJobs, users, ExportJobStatus } from "$lib/db/schema"
import { eq } from "drizzle-orm"
import { logger } from "$lib/logger"
import {
  generateUserDataExport,
  uploadExportFile,
} from "$lib/gdpr/export-service"
import { sendEmail } from "$lib/email/email-service"

export interface ProcessExportsResult {
  success: boolean
  processed: number
  succeeded: number
  failed: number
  successCount: number
  failureCount: number
  message?: string
}

export async function runProcessExports(): Promise<ProcessExportsResult> {
  logger.info("Processing data export jobs")

  const db = await getDatabase()

  // Find pending export jobs
  const pendingJobs = await db
    .select()
    .from(dataExportJobs)
    .where(eq(dataExportJobs.status, ExportJobStatus.PENDING))
    .limit(10) // Process max 10 per run

  if (pendingJobs.length === 0) {
    logger.info("No pending export jobs found")
    return {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      successCount: 0,
      failureCount: 0,
      message: "No pending exports",
    }
  }

  logger.info("Found pending export jobs", { count: pendingJobs.length })

  let successCount = 0
  let failureCount = 0

  // Process each job
  for (const job of pendingJobs) {
    try {
      logger.info("Processing export job", { jobId: job.id, userId: job.userId })

      // Update status to processing
      await db
        .update(dataExportJobs)
        .set({ status: ExportJobStatus.PROCESSING })
        .where(eq(dataExportJobs.id, job.id))

      // Generate export data
      const exportData = await generateUserDataExport(job.userId)

      // Upload to Cloud Storage
      const { fileUrl, fileSize } = await uploadExportFile(
        job.userId,
        exportData,
      )

      // Update job as completed
      await db
        .update(dataExportJobs)
        .set({
          status: ExportJobStatus.COMPLETED,
          fileUrl,
          fileSize,
          completedAt: new Date(),
        })
        .where(eq(dataExportJobs.id, job.id))

      // Get user email for notification
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, job.userId))

      if (user) {
        // Send email notification
        await sendEmail({
          to: user.email,
          subject: "KeyFate: Your Data Export is Ready",
          html: `
            <h2>Your Data Export is Ready</h2>
            <p>Your data export has been completed and is ready for download.</p>
            <p><a href="${fileUrl}">Download Your Data</a></p>
            <p><strong>File Size:</strong> ${(fileSize / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Link expires:</strong> ${job.expiresAt.toLocaleDateString()}</p>
            <p>For security reasons, this link will expire in 24 hours and can only be downloaded 3 times.</p>
          `,
          unsubscribeGroup: "ACCOUNT_NOTIFICATIONS",
        })
      }

      successCount++
      logger.info("Export job completed successfully", { jobId: job.id })
    } catch (error) {
      logger.error("Error processing export job", error instanceof Error ? error : undefined, { jobId: job.id })

      // Mark job as failed
      await db
        .update(dataExportJobs)
        .set({
          status: ExportJobStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(dataExportJobs.id, job.id))

      failureCount++
    }
  }

  logger.info("Export processing complete", { successCount, failureCount })

  return {
    success: true,
    processed: pendingJobs.length,
    succeeded: successCount,
    failed: failureCount,
    successCount,
    failureCount,
  }
}
