import {
  authorizeRequest,
  CRON_CONFIG,
  isApproachingTimeout,
  logCronMetrics,
  sanitizeError,
} from "@/lib/cron/utils"
import { getDatabase } from "@/lib/db/drizzle"
import {
  checkInTokens,
  emailFailures,
  reminderJobs,
  secrets,
  users,
  type Secret,
  type User,
} from "@/lib/db/schema"
import { sendAdminNotification } from "@/lib/email/admin-notification-service"
import { logEmailFailure } from "@/lib/email/email-failure-logger"
import { sendReminderEmail } from "@/lib/email/email-service"
import { randomBytes } from "crypto"
import { and, desc, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type ReminderType =
  | "1_hour"
  | "12_hours"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "25_percent"
  | "50_percent"

type SecretWithUser = {
  secret: Secret
  user: User
}

type ReminderJob = typeof reminderJobs.$inferSelect

type PendingReminderWithDetails = {
  reminder: ReminderJob
  secret: Secret
  user: User
}

type DatabaseConnection = Awaited<ReturnType<typeof getDatabase>>

async function markReminderSent(
  db: DatabaseConnection,
  reminderId: string,
): Promise<void> {
  try {
    const now = new Date()

    await db
      .update(reminderJobs)
      .set({
        status: "sent",
        sentAt: now,
        updatedAt: now,
      } as any)
      .where(eq(reminderJobs.id, reminderId))

    if (process.env.NODE_ENV === "development") {
      console.log(`[check-secrets] Marked reminder ${reminderId} as sent`)
    }
  } catch (error) {
    console.error(
      `[check-secrets] Error marking reminder sent:`,
      sanitizeError(error),
    )
    throw error
  }
}

async function markReminderFailed(
  db: DatabaseConnection,
  reminderId: string,
  errorMessage: string,
): Promise<void> {
  try {
    const now = new Date()

    await db
      .update(reminderJobs)
      .set({
        status: "failed",
        failedAt: now,
        error: errorMessage,
        retryCount: sql`COALESCE(${reminderJobs.retryCount}, 0) + 1`,
        nextRetryAt: sql`${now}::timestamp + (INTERVAL '${sql.raw(CRON_CONFIG.RETRY_BACKOFF_BASE_MINUTES.toString())} minutes' * POW(${sql.raw(CRON_CONFIG.RETRY_BACKOFF_EXPONENT.toString())}, COALESCE(${reminderJobs.retryCount}, 0)))`,
        updatedAt: now,
      } as any)
      .where(
        and(
          eq(reminderJobs.id, reminderId),
          lt(
            sql`COALESCE(${reminderJobs.retryCount}, 0)`,
            CRON_CONFIG.MAX_RETRIES,
          ),
        ),
      )

    if (process.env.NODE_ENV === "development") {
      console.log(`[check-secrets] Marked reminder ${reminderId} as failed`)
    }
  } catch (err) {
    console.error(
      `[check-secrets] Error marking reminder failed:`,
      sanitizeError(err),
    )
  }
}

function calculateUrgency(
  nextCheckIn: Date,
): "critical" | "high" | "medium" | "low" {
  const now = new Date()
  const msRemaining = nextCheckIn.getTime() - now.getTime()
  const hoursRemaining = msRemaining / (1000 * 60 * 60)

  if (hoursRemaining < 1) {
    return "critical"
  } else if (hoursRemaining < 24) {
    return "high"
  } else if (hoursRemaining < 24 * 7) {
    return "medium"
  } else {
    return "low"
  }
}

async function generateCheckInToken(
  db: DatabaseConnection,
  secretId: string,
): Promise<{ token: string; url: string }> {
  const now = new Date()

  const existingToken = await db
    .select()
    .from(checkInTokens)
    .where(
      and(
        eq(checkInTokens.secretId, secretId),
        isNull(checkInTokens.usedAt),
        gt(checkInTokens.expiresAt, now),
      ),
    )
    .limit(1)

  if (existingToken.length > 0) {
    const baseUrl = process.env.NEXTAUTH_URL
    if (!baseUrl) {
      throw new Error("NEXTAUTH_URL environment variable is required")
    }
    const url = `${baseUrl}/check-in?token=${existingToken[0].token}`
    return { token: existingToken[0].token, url }
  }

  const token = randomBytes(32).toString("hex")

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  await db.insert(checkInTokens).values({
    secretId,
    token,
    expiresAt,
  })

  const baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl) {
    throw new Error("NEXTAUTH_URL environment variable is required")
  }
  const url = `${baseUrl}/check-in?token=${token}`

  return { token, url }
}

async function processSecret(
  db: DatabaseConnection,
  secret: Secret,
  user: User,
  reminderType: ReminderType,
  reminderId?: string,
): Promise<{ sent: boolean; error?: string; reminderId?: string }> {
  try {
    if (!secret.nextCheckIn) {
      console.warn(
        `[check-secrets] Secret ${secret.id} missing nextCheckIn, skipping`,
      )
      return { sent: false, error: "missing_next_check_in" }
    }

    const nextCheckIn: Date = new Date(secret.nextCheckIn)

    const urgency = calculateUrgency(nextCheckIn)

    const now = new Date()
    const msRemaining = nextCheckIn.getTime() - now.getTime()
    const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24))

    const { url: checkInUrl } = await generateCheckInToken(db, secret.id)

    const result = await sendReminderEmail({
      userEmail: user.email,
      userName: user.name || user.email.split("@")[0],
      secretTitle: secret.title,
      daysRemaining,
      checkInUrl,
      urgencyLevel: urgency,
      reminderType,
    })

    if (!result.success) {
      await logEmailFailure({
        emailType: "reminder",
        provider:
          (result.provider as "sendgrid" | "console-dev" | "resend") ||
          "sendgrid",
        recipient: user.email,
        subject: `Check-in Reminder: ${secret.title}`,
        errorMessage: result.error || "Unknown error",
      })

      const [failureStats] = await db
        .select({
          totalRetries: sql<number>`COALESCE(SUM(${emailFailures.retryCount}), 0)`,
        })
        .from(emailFailures)
        .where(
          and(
            eq(emailFailures.emailType, "reminder"),
            eq(emailFailures.recipient, user.email),
          ),
        )
        .orderBy(desc(emailFailures.createdAt))
        .limit(5)

      const retryCount = failureStats?.totalRetries || 0

      if (retryCount > CRON_CONFIG.ADMIN_NOTIFICATION_THRESHOLD) {
        await sendAdminNotification({
          emailType: "reminder",
          recipient: user.email,
          errorMessage: result.error || "Unknown error",
          secretTitle: secret.title,
          timestamp: new Date(),
          retryCount,
        })
      }

      if (reminderId) {
        await markReminderFailed(
          db,
          reminderId,
          result.error || "Unknown error",
        )
      }

      return {
        sent: false,
        error: result.error,
        reminderId,
      }
    }

    if (reminderId) {
      await markReminderSent(db, reminderId)
    }

    return { sent: true, reminderId }
  } catch (error) {
    const errorMessage = sanitizeError(error)

    console.error(`[check-secrets] Failed to process secret:`, errorMessage)

    if (reminderId) {
      await markReminderFailed(db, reminderId, errorMessage)
    }

    return {
      sent: false,
      error: errorMessage,
      reminderId,
    }
  }
}

async function processFailedReminders(
  db: DatabaseConnection,
  startTimeMs: number,
): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date()
  let processed = 0
  let sent = 0
  let failed = 0

  try {
    const failedReminders = await db
      .select({
        reminder: reminderJobs,
        secret: secrets,
        user: users,
      })
      .from(reminderJobs)
      .innerJoin(secrets, eq(reminderJobs.secretId, secrets.id))
      .innerJoin(users, eq(secrets.userId, users.id))
      .where(
        and(
          eq(reminderJobs.status, "failed"),
          lt(reminderJobs.retryCount, CRON_CONFIG.MAX_RETRIES),
          lt(reminderJobs.nextRetryAt, now),
        ),
      )
      .limit(50)

    for (const { reminder, secret, user } of failedReminders) {
      if (isApproachingTimeout(startTimeMs)) {
        console.log(
          `[check-secrets] Approaching timeout, stopping retry processing`,
        )
        break
      }

      processed++

      const result = await processSecret(
        db,
        secret,
        user,
        reminder.reminderType as ReminderType,
        reminder.id,
      )

      if (result.sent) {
        sent++
      } else {
        failed++
      }
    }
  } catch (error) {
    console.error(
      `[check-secrets] Error processing failed reminders:`,
      sanitizeError(error),
    )
  }

  return { processed, sent, failed }
}

async function fetchPendingReminders(
  db: DatabaseConnection,
  offset: number,
): Promise<PendingReminderWithDetails[]> {
  const now = new Date()

  const results = await db
    .select({
      reminder: reminderJobs,
      secret: secrets,
      user: users,
    })
    .from(reminderJobs)
    .innerJoin(secrets, eq(reminderJobs.secretId, secrets.id))
    .innerJoin(users, eq(secrets.userId, users.id))
    .where(
      and(
        eq(reminderJobs.status, "pending"),
        lt(reminderJobs.scheduledFor, now),
        eq(secrets.status, "active"),
        isNotNull(secrets.serverShare),
        isNotNull(secrets.nextCheckIn),
      ),
    )
    .orderBy(reminderJobs.scheduledFor)
    .limit(CRON_CONFIG.BATCH_SIZE)
    .offset(offset)

  return results
}

export async function POST(req: NextRequest) {
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const startDate = new Date()
  console.log(`[check-secrets] Cron job started at ${startDate.toISOString()}`)

  try {
    const db = await getDatabase()

    let remindersProcessed = 0
    let remindersSent = 0
    let remindersFailed = 0
    let offset = 0
    let hasMore = true

    while (hasMore && !isApproachingTimeout(startTime)) {
      const batchReminders = await fetchPendingReminders(db, offset)

      if (batchReminders.length < CRON_CONFIG.BATCH_SIZE) {
        hasMore = false
      }

      for (const { reminder, secret, user } of batchReminders) {
        if (isApproachingTimeout(startTime)) {
          console.log(
            `[check-secrets] Approaching timeout, stopping processing. Processed ${remindersProcessed} reminders`,
          )
          break
        }

        remindersProcessed++

        if (process.env.NODE_ENV === "development") {
          console.log(
            `[check-secrets] Processing reminder ${reminder.id} (type: ${reminder.reminderType}) for secret ${secret.id}`,
          )
        }

        const result = await processSecret(
          db,
          secret,
          user,
          reminder.reminderType as ReminderType,
          reminder.id,
        )

        if (result.sent) {
          remindersSent++
        } else {
          remindersFailed++
        }
      }

      offset += CRON_CONFIG.BATCH_SIZE
    }

    const retryStats = await processFailedReminders(db, startTime)

    const duration = Date.now() - startTime

    logCronMetrics("check-secrets", {
      duration,
      processed: remindersProcessed + retryStats.processed,
      succeeded: remindersSent + retryStats.sent,
      failed: remindersFailed + retryStats.failed,
    })

    return NextResponse.json({
      remindersProcessed,
      remindersSent,
      remindersFailed,
      retriesProcessed: retryStats.processed,
      retriesSent: retryStats.sent,
      retriesFailed: retryStats.failed,
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[check-secrets] Error:", sanitizeError(error))

    const errorDetails = {
      error: "Database operation failed",
      message: sanitizeError(error),
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(errorDetails, { status: 500 })
  }
}
