import { getDatabase } from "@/lib/db/drizzle"
import {
  secrets,
  checkInTokens,
  users,
  emailFailures,
  reminderJobs,
} from "@/lib/db/schema"
import { and, eq, isNotNull, desc, sql, lt } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { sendReminderEmail } from "@/lib/email/email-service"
import { logEmailFailure } from "@/lib/email/email-failure-logger"
import { sendAdminNotification } from "@/lib/email/admin-notification-service"
import { randomBytes } from "crypto"
import {
  sanitizeError,
  authorizeRequest,
  CRON_CONFIG,
  isApproachingTimeout,
  logCronMetrics,
} from "@/lib/cron/utils"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

// Type definition for reminder types
type ReminderType =
  | "1_hour"
  | "12_hours"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "25_percent"
  | "50_percent"

/**
 * Determine all applicable reminder types based on time remaining
 * Returns array of reminder types that should be sent (empty if none)
 *
 * IMPORTANT: Returns ALL reminder types whose thresholds have been crossed,
 * allowing the cron job to send multiple reminders in the same run if needed.
 */
function getApplicableReminderTypes(
  nextCheckIn: Date,
  checkInDays: number,
): ReminderType[] {
  const now = new Date()
  const msRemaining = nextCheckIn.getTime() - now.getTime()

  // Return empty array for expired check-ins
  if (msRemaining <= 0) {
    return []
  }

  const hoursRemaining = msRemaining / (1000 * 60 * 60)
  const daysRemaining = hoursRemaining / 24
  const totalHours = checkInDays * 24
  const percentRemaining = (hoursRemaining / totalHours) * 100

  const applicableTypes: ReminderType[] = []

  // Check all thresholds and collect applicable types
  // Order matters: check most urgent first to prioritize in result array

  if (hoursRemaining <= 1) {
    applicableTypes.push("1_hour")
  }

  if (hoursRemaining <= 12) {
    applicableTypes.push("12_hours")
  }

  if (hoursRemaining <= 24) {
    applicableTypes.push("24_hours")
  }

  if (daysRemaining <= 3) {
    applicableTypes.push("3_days")
  }

  if (daysRemaining <= 7) {
    applicableTypes.push("7_days")
  }

  if (percentRemaining <= 25) {
    applicableTypes.push("25_percent")
  }

  if (percentRemaining <= 50) {
    applicableTypes.push("50_percent")
  }

  return applicableTypes
}

/**
 * Check if a reminder has already been sent for this secret and reminder type
 * during the current check-in period
 *
 * BUG FIX #1: Filter by lastCheckIn timestamp to prevent old reminder records
 * from blocking new check-in periods
 */
async function hasReminderBeenSent(
  secretId: string,
  reminderType: ReminderType,
  lastCheckIn: Date,
): Promise<boolean> {
  try {
    const db = await getDatabase()

    console.log(
      `[check-secrets] Checking if reminder already sent: secretId=${secretId}, type=${reminderType}, lastCheckIn=${lastCheckIn.toISOString()}`,
    )

    const existingReminder = await db
      .select()
      .from(reminderJobs)
      .where(
        and(
          eq(reminderJobs.secretId, secretId),
          eq(reminderJobs.reminderType, reminderType),
          eq(reminderJobs.status, "sent"),
          // BUG FIX #1: Only check reminders sent during current check-in period
          sql`${reminderJobs.sentAt} >= ${lastCheckIn.toISOString()}`,
        ),
      )
      .limit(1)

    const alreadySent = existingReminder.length > 0
    console.log(
      `[check-secrets] Reminder check result: alreadySent=${alreadySent}, found ${existingReminder.length} records in current period`,
    )

    return alreadySent
  } catch (error) {
    console.error(`[check-secrets] Error checking reminder status:`, error)
    // On error, return false to allow sending (fail open)
    // This prevents blocking all reminders if there's a DB issue
    return false
  }
}

/**
 * Calculate scheduledFor timestamp for a reminder type
 */
function calculateScheduledFor(
  reminderType: ReminderType,
  nextCheckIn: Date,
  checkInDays: number,
): Date {
  const checkInTime = nextCheckIn.getTime()

  switch (reminderType) {
    case "1_hour":
      return new Date(checkInTime - 1 * 60 * 60 * 1000)
    case "12_hours":
      return new Date(checkInTime - 12 * 60 * 60 * 1000)
    case "24_hours":
      return new Date(checkInTime - 24 * 60 * 60 * 1000)
    case "3_days":
      return new Date(checkInTime - 3 * 24 * 60 * 60 * 1000)
    case "7_days":
      return new Date(checkInTime - 7 * 24 * 60 * 60 * 1000)
    case "25_percent":
      return new Date(checkInTime - checkInDays * 24 * 60 * 60 * 1000 * 0.75)
    case "50_percent":
      return new Date(checkInTime - checkInDays * 24 * 60 * 60 * 1000 * 0.5)
  }
}

/**
 * Try to record reminder as pending (race-safe)
 * Returns true if successfully recorded, false if already exists
 */
async function tryRecordReminderPending(
  secretId: string,
  reminderType: ReminderType,
  nextCheckIn: Date,
  checkInDays: number,
): Promise<{ success: boolean; id?: string }> {
  try {
    const db = await getDatabase()
    const scheduledFor = calculateScheduledFor(
      reminderType,
      nextCheckIn,
      checkInDays,
    )

    const [inserted] = await db
      .insert(reminderJobs)
      .values({
        secretId,
        reminderType,
        scheduledFor,
      })
      .onConflictDoNothing()
      .returning({ id: reminderJobs.id })

    if (!inserted?.id) {
      console.log(
        `[check-secrets] Reminder already exists: secretId=${secretId}, type=${reminderType}`,
      )
      return { success: false }
    }

    console.log(
      `[check-secrets] Inserted pending reminder job with ID: ${inserted.id}`,
    )

    return { success: true, id: inserted.id }
  } catch (error) {
    console.error(
      `[check-secrets] Error recording pending reminder:`,
      sanitizeError(error, secretId),
    )
    return { success: false }
  }
}

/**
 * Mark reminder as sent
 */
async function markReminderSent(reminderId: string): Promise<void> {
  try {
    const db = await getDatabase()
    const now = new Date()

    await db.execute(sql`
      UPDATE reminder_jobs
      SET status = 'sent', sent_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
      WHERE id = ${reminderId}
    `)

    console.log(`[check-secrets] Marked reminder ${reminderId} as sent`)
  } catch (error) {
    console.error(
      `[check-secrets] Error marking reminder sent:`,
      sanitizeError(error),
    )
    throw error
  }
}

/**
 * Mark reminder as failed
 */
async function markReminderFailed(
  reminderId: string,
  error: string,
): Promise<void> {
  try {
    const db = await getDatabase()
    const now = new Date()

    await db.execute(sql`
      UPDATE reminder_jobs
      SET 
        status = 'failed',
        failed_at = ${now.toISOString()},
        error = ${error},
        retry_count = COALESCE(retry_count, 0) + 1,
        next_retry_at = ${now.toISOString()}::timestamp + 
          (INTERVAL '5 minutes' * POW(2, COALESCE(retry_count, 0))),
        updated_at = ${now.toISOString()}
      WHERE id = ${reminderId} AND COALESCE(retry_count, 0) < ${CRON_CONFIG.MAX_RETRIES}
    `)

    console.log(`[check-secrets] Marked reminder ${reminderId} as failed`)
  } catch (err) {
    console.error(
      `[check-secrets] Error marking reminder failed:`,
      sanitizeError(err),
    )
  }
}

/**
 * Calculate urgency level based on time remaining until nextCheckIn
 */
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

/**
 * Generate a secure check-in token and URL
 */
async function generateCheckInToken(
  secretId: string,
): Promise<{ token: string; url: string }> {
  const db = await getDatabase()

  // Generate secure random token
  const token = randomBytes(32).toString("hex")

  // Token expires in 30 days
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  // Store token in database
  await db.insert(checkInTokens).values({
    secretId,
    token,
    expiresAt,
  })

  // Generate check-in URL
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const url = `${baseUrl}/check-in?token=${token}`

  return { token, url }
}

/**
 * Process a single secret for reminder sending (race-safe)
 */
async function processSecret(
  secret: any,
  user: any,
  reminderType: ReminderType,
): Promise<{ sent: boolean; error?: string; reminderId?: string }> {
  let reminderId: string | undefined

  try {
    if (!secret.nextCheckIn) {
      console.warn(
        `[check-secrets] Secret ${secret.id} missing nextCheckIn, skipping`,
      )
      return { sent: false, error: "missing_next_check_in" }
    }

    const nextCheckIn: Date = new Date(secret.nextCheckIn)

    const recordResult = await tryRecordReminderPending(
      secret.id,
      reminderType,
      nextCheckIn,
      secret.checkInDays,
    )

    if (!recordResult.success) {
      return {
        sent: false,
        error: "already_processing_or_sent",
      }
    }

    reminderId = recordResult.id

    const urgency = calculateUrgency(nextCheckIn)

    const now = new Date()
    const msRemaining = nextCheckIn.getTime() - now.getTime()
    const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24))

    const { url: checkInUrl } = await generateCheckInToken(secret.id)

    const result = await sendReminderEmail({
      userEmail: user.email,
      userName: user.name || user.email.split("@")[0],
      secretTitle: secret.title,
      daysRemaining,
      checkInUrl,
      urgencyLevel: urgency,
    })

    if (!result.success) {
      const db = await getDatabase()
      await logEmailFailure({
        emailType: "reminder",
        provider:
          (result.provider as "sendgrid" | "console-dev" | "resend") ||
          "sendgrid",
        recipient: user.email,
        subject: `Check-in Reminder: ${secret.title}`,
        errorMessage: result.error || "Unknown error",
      })

      const recentFailures = await db
        .select()
        .from(emailFailures)
        .where(
          and(
            eq(emailFailures.emailType, "reminder"),
            eq(emailFailures.recipient, user.email),
          ),
        )
        .orderBy(desc(emailFailures.createdAt))
        .limit(5)

      const retryCount = recentFailures.reduce(
        (sum, f) => sum + f.retryCount,
        0,
      )

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
        await markReminderFailed(reminderId, result.error || "Unknown error")
      }

      return {
        sent: false,
        error: result.error,
        reminderId,
      }
    }

    if (reminderId) {
      await markReminderSent(reminderId)
    }

    return { sent: true, reminderId }
  } catch (error) {
    const errorMessage = sanitizeError(error, secret.id)

    console.error(`[check-secrets] Failed to process secret:`, errorMessage)

    if (reminderId) {
      await markReminderFailed(reminderId, errorMessage)
    }

    return {
      sent: false,
      error: errorMessage,
      reminderId,
    }
  }
}

/**
 * Process failed reminders that are ready for retry
 */
async function processFailedReminders(
  db: any,
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

    for (const row of failedReminders) {
      if (isApproachingTimeout(startTimeMs)) {
        console.log(
          `[check-secrets] Approaching timeout, stopping retry processing`,
        )
        break
      }

      const { reminder, secret, user } = row
      processed++

      const result = await processSecret(
        secret,
        user,
        reminder.reminderType as ReminderType,
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

/**
 * Main cron job handler
 */
export async function POST(req: NextRequest) {
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const startDate = new Date()
  console.log(`[check-secrets] Cron job started at ${startDate.toISOString()}`)

  try {
    const db = await getDatabase()

    const allActiveSecrets = await db
      .select({
        secret: secrets,
        user: users,
      })
      .from(secrets)
      .innerJoin(users, eq(secrets.userId, users.id))
      .where(
        and(
          eq(secrets.status, "active"),
          isNotNull(secrets.serverShare),
          isNotNull(secrets.nextCheckIn),
        ),
      )

    console.log(
      `[check-secrets] Found ${allActiveSecrets.length} active secrets to process`,
    )

    let remindersProcessed = 0
    let remindersSent = 0
    let remindersFailed = 0
    let secretsProcessed = 0

    for (const row of allActiveSecrets) {
      if (isApproachingTimeout(startTime)) {
        console.log(
          `[check-secrets] Approaching timeout, stopping processing. Processed ${secretsProcessed}/${allActiveSecrets.length} secrets`,
        )
        break
      }

      const { secret, user } = row
      secretsProcessed++

      if (!secret.nextCheckIn) {
        console.warn(
          `[check-secrets] Secret ${secret.id} missing nextCheckIn, skipping`,
        )
        continue
      }

      if (!secret.lastCheckIn) {
        console.warn(
          `[check-secrets] Secret ${secret.id} missing lastCheckIn - data integrity issue`,
        )
        continue
      }

      const nextCheckIn: Date = new Date(secret.nextCheckIn)
      const lastCheckIn: Date = new Date(secret.lastCheckIn)
      const applicableTypes = getApplicableReminderTypes(
        nextCheckIn,
        secret.checkInDays,
      )

      console.log(
        `[check-secrets] Secret ${secret.id}: ${applicableTypes.length} applicable reminder types`,
      )

      let remindersForThisSecret = 0

      for (const reminderType of applicableTypes) {
        if (
          isApproachingTimeout(startTime) ||
          remindersForThisSecret >= CRON_CONFIG.MAX_REMINDERS_PER_RUN_PER_SECRET
        ) {
          break
        }

        const alreadySent = await hasReminderBeenSent(
          secret.id,
          reminderType,
          lastCheckIn,
        )

        if (alreadySent) {
          continue
        }

        remindersProcessed++
        remindersForThisSecret++

        const result = await processSecret(secret, user, reminderType)

        if (result.sent) {
          remindersSent++
        } else {
          remindersFailed++
        }
      }
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
      secretsProcessed,
      totalSecrets: allActiveSecrets.length,
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
