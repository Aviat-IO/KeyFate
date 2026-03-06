import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { authorizeRequest } from "$lib/cron/utils"
import { getDatabase } from "$lib/db/drizzle"
import { secrets, reminderJobs, emailFailures } from "$lib/db/schema"
import { eq, lt, and, sql, isNotNull, isNull, gt } from "drizzle-orm"

/**
 * GET /api/health/cron-diagnostics
 *
 * Deep diagnostic endpoint for cron and email system state.
 * Returns actual database counts to help identify why crons
 * find 0 items to process.
 *
 * Authentication: Requires CRON_SECRET.
 */
export const GET: RequestHandler = async (event) => {
  if (!authorizeRequest(event.request, event.url)) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await getDatabase()
    const now = new Date()

    // 1. Active secrets overview
    const [activeSecretStats] = await db
      .select({
        total: sql<number>`count(*)`,
        withServerShare: sql<number>`count(*) filter (where ${secrets.serverShare} is not null)`,
        withNextCheckIn: sql<number>`count(*) filter (where ${secrets.nextCheckIn} is not null)`,
        overdueCount: sql<number>`count(*) filter (where ${secrets.nextCheckIn} < ${now})`,
      })
      .from(secrets)
      .where(eq(secrets.status, "active"))

    // 2. Overdue secrets detail (no sensitive data)
    const overdueSecrets = await db
      .select({
        id: secrets.id,
        title: secrets.title,
        nextCheckIn: secrets.nextCheckIn,
        checkInDays: secrets.checkInDays,
        retryCount: secrets.retryCount,
        lastError: secrets.lastError,
        lastRetryAt: secrets.lastRetryAt,
        hasServerShare: sql<boolean>`${secrets.serverShare} is not null`,
        createdAt: secrets.createdAt,
      })
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          lt(secrets.nextCheckIn, now),
        ),
      )

    // 3. Reminder jobs breakdown
    const [reminderStats] = await db
      .select({
        totalPending: sql<number>`count(*) filter (where ${reminderJobs.status} = 'pending')`,
        totalSent: sql<number>`count(*) filter (where ${reminderJobs.status} = 'sent')`,
        totalFailed: sql<number>`count(*) filter (where ${reminderJobs.status} = 'failed')`,
        totalCancelled: sql<number>`count(*) filter (where ${reminderJobs.status} = 'cancelled')`,
        pendingOverdue: sql<number>`count(*) filter (where ${reminderJobs.status} = 'pending' and ${reminderJobs.scheduledFor} < ${now})`,
        pendingFuture: sql<number>`count(*) filter (where ${reminderJobs.status} = 'pending' and ${reminderJobs.scheduledFor} >= ${now})`,
        failedMaxRetries: sql<number>`count(*) filter (where ${reminderJobs.status} = 'failed' and ${reminderJobs.retryCount} >= 3)`,
        failedRetryable: sql<number>`count(*) filter (where ${reminderJobs.status} = 'failed' and ${reminderJobs.retryCount} < 3)`,
      })
      .from(reminderJobs)

    // 4. Failed reminders with errors (last 10)
    const recentFailedReminders = await db
      .select({
        id: reminderJobs.id,
        secretId: reminderJobs.secretId,
        reminderType: reminderJobs.reminderType,
        scheduledFor: reminderJobs.scheduledFor,
        status: reminderJobs.status,
        error: reminderJobs.error,
        retryCount: reminderJobs.retryCount,
        nextRetryAt: reminderJobs.nextRetryAt,
        failedAt: reminderJobs.failedAt,
      })
      .from(reminderJobs)
      .where(eq(reminderJobs.status, "failed"))
      .orderBy(sql`${reminderJobs.failedAt} desc nulls last`)
      .limit(10)

    // 5. Recent email failures
    const [emailFailureStats] = await db
      .select({
        total: sql<number>`count(*)`,
        last24h: sql<number>`count(*) filter (where ${emailFailures.createdAt} > ${new Date(now.getTime() - 24 * 60 * 60 * 1000)})`,
      })
      .from(emailFailures)

    // 6. Environment config check
    const envCheck = {
      SITE_URL: !!process.env.PUBLIC_SITE_URL || !!process.env.NEXT_PUBLIC_SITE_URL,
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      SENDGRID_ADMIN_EMAIL: !!process.env.SENDGRID_ADMIN_EMAIL,
      CRON_ENABLED: process.env.CRON_ENABLED !== "false",
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "(default)",
      // Legacy check
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "SET (legacy)" : "NOT SET",
    }

    // 7. All secrets status breakdown
    const [allSecretStats] = await db
      .select({
        active: sql<number>`count(*) filter (where ${secrets.status} = 'active')`,
        triggered: sql<number>`count(*) filter (where ${secrets.status} = 'triggered')`,
        paused: sql<number>`count(*) filter (where ${secrets.status} = 'paused')`,
        total: sql<number>`count(*)`,
      })
      .from(secrets)

    return json({
      timestamp: now.toISOString(),
      environment: envCheck,
      secrets: {
        statusBreakdown: allSecretStats,
        active: activeSecretStats,
        overdue: overdueSecrets.map((s) => ({
          ...s,
          overdueBy: s.nextCheckIn
            ? `${Math.round((now.getTime() - new Date(s.nextCheckIn).getTime()) / (1000 * 60 * 60))}h`
            : "unknown",
        })),
      },
      reminderJobs: {
        stats: reminderStats,
        recentFailures: recentFailedReminders,
      },
      emailFailures: emailFailureStats,
      diagnosis: generateDiagnosis(
        activeSecretStats,
        reminderStats,
        overdueSecrets.length,
        envCheck,
      ),
    })
  } catch (error) {
    return json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function generateDiagnosis(
  activeStats: Record<string, number>,
  reminderStats: Record<string, number>,
  overdueCount: number,
  envCheck: Record<string, unknown>,
): string[] {
  const issues: string[] = []

  if (Number(activeStats.total) > 0 && Number(reminderStats.totalPending) === 0 && Number(reminderStats.pendingFuture) === 0) {
    issues.push(
      "CRITICAL: Active secrets exist but no pending reminder jobs found. Reminder scheduling may have failed during secret creation.",
    )
  }

  if (Number(reminderStats.failedMaxRetries) > 0) {
    issues.push(
      `WARNING: ${reminderStats.failedMaxRetries} reminder(s) have exhausted all retries. These will not be processed unless manually reset.`,
    )
  }

  if (overdueCount > 0) {
    issues.push(
      `WARNING: ${overdueCount} secret(s) are overdue but process-reminders has not triggered disclosure. Check process-reminders logs.`,
    )
  }

  if (!envCheck.SITE_URL) {
    issues.push(
      "CRITICAL: PUBLIC_SITE_URL is not set. Check-in URLs in reminder emails will use fallback domain.",
    )
  }

  if (!envCheck.SENDGRID_API_KEY) {
    issues.push("CRITICAL: SENDGRID_API_KEY is not set. No emails will be sent.")
  }

  if (envCheck.NEXTAUTH_URL === "NOT SET" && envCheck.NODE_ENV === "production") {
    issues.push(
      "INFO: NEXTAUTH_URL is not set (expected for SvelteKit). Ensure code uses SITE_URL from $lib/env instead.",
    )
  }

  if (issues.length === 0) {
    issues.push("OK: No issues detected.")
  }

  return issues
}
