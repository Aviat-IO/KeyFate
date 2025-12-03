import { NextRequest, NextResponse } from "next/server"
import { authorizeRequest } from "@/lib/cron/utils"
import { getDatabase } from "@/lib/db/get-database"
import { dataExportJobs, users, ExportJobStatus } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  generateUserDataExport,
  uploadExportFile,
} from "@/lib/gdpr/export-service"
import { sendEmail } from "@/lib/email/email-service"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/process-exports
 * Health check endpoint for monitoring
 */
export async function GET(request: NextRequest) {
  if (!authorizeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ status: "ok", job: "process-exports" })
}

/**
 * POST /api/cron/process-exports
 * Process pending data export jobs
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    if (!authorizeRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CRON] Processing data export jobs...")

    const db = await getDatabase()

    // Find pending export jobs
    const pendingJobs = await db
      .select()
      .from(dataExportJobs)
      .where(eq(dataExportJobs.status, ExportJobStatus.PENDING))
      .limit(10) // Process max 10 per run

    if (pendingJobs.length === 0) {
      console.log("[CRON] No pending export jobs found")
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No pending exports",
      })
    }

    console.log(`[CRON] Found ${pendingJobs.length} pending export jobs`)

    let successCount = 0
    let failureCount = 0

    // Process each job
    for (const job of pendingJobs) {
      try {
        console.log(
          `[CRON] Processing export job ${job.id} for user ${job.userId}`,
        )

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
        console.log(`[CRON] Export job ${job.id} completed successfully`)
      } catch (error) {
        console.error(`[CRON] Error processing export job ${job.id}:`, error)

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

    console.log(
      `[CRON] Export processing complete: ${successCount} success, ${failureCount} failures`,
    )

    return NextResponse.json({
      success: true,
      processed: pendingJobs.length,
      successCount,
      failureCount,
    })
  } catch (error) {
    console.error("[CRON] Error in process-exports:", error)
    return NextResponse.json(
      { error: "Failed to process exports" },
      { status: 500 },
    )
  }
}
