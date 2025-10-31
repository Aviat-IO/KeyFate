import { NextRequest, NextResponse } from "next/server"
import { authorizeRequest } from "@/lib/cron/utils"
import {
  getPendingDeletions,
  executeAccountDeletion,
} from "@/lib/gdpr/deletion-service"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/cron/process-deletions
 * Execute account deletions that are past grace period
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    if (!authorizeRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CRON] Processing account deletions...")

    // Get deletions past grace period
    const pendingDeletions = await getPendingDeletions()

    if (pendingDeletions.length === 0) {
      console.log("[CRON] No pending deletions found")
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No pending deletions",
      })
    }

    console.log(`[CRON] Found ${pendingDeletions.length} pending deletions`)

    let successCount = 0
    let failureCount = 0

    // Process each deletion
    for (const deletion of pendingDeletions) {
      try {
        console.log(
          `[CRON] Processing deletion ${deletion.id} for user ${deletion.userId}`,
        )

        await executeAccountDeletion(deletion.userId)

        successCount++
        console.log(`[CRON] Account deletion ${deletion.id} completed`)
      } catch (error) {
        console.error(`[CRON] Error processing deletion ${deletion.id}:`, error)
        failureCount++
      }
    }

    console.log(
      `[CRON] Deletion processing complete: ${successCount} success, ${failureCount} failures`,
    )

    return NextResponse.json({
      success: true,
      processed: pendingDeletions.length,
      successCount,
      failureCount,
    })
  } catch (error) {
    console.error("[CRON] Error in process-deletions:", error)
    return NextResponse.json(
      { error: "Failed to process deletions" },
      { status: 500 },
    )
  }
}
