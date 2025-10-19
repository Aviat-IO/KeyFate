import { getDatabase } from "@/lib/db/drizzle"
import {
  secrets,
  checkInTokens,
  users,
  emailFailures,
  reminderJobs,
  type Secret,
  type User,
  type ReminderJob,
} from "@/lib/db/schema"
import { and, eq, isNotNull, desc, sql, lt, isNull, gt, gte } from "drizzle-orm"
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

export const dynamic = "force-dynamic"

type ReminderType =
  | "1_hour"
  | "12_hours"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "25_percent"
  | "50_percent"

type SecretWithUserAndReminders = {
  secret: Secret
  user: User
  sentReminders: ReminderType[]
}

type DatabaseConnection = Awaited<ReturnType<typeof getDatabase>>

function getApplicableReminderTypes(
  nextCheckIn: Date,
  checkInDays: number,
): ReminderType[] {
  const now = new Date()
  const msRemaining = nextCheckIn.getTime() - now.getTime()

  if (msRemaining <= 0) {
    return []
  }

  const hoursRemaining = msRemaining / (1000 * 60 * 60)
  const daysRemaining = hoursRemaining / 24
  const totalHours = checkInDays * 24
  const percentRemaining = (hoursRemaining / totalHours) * 100

  if (hoursRemaining <= 1) return ["1_hour"]
  if (hoursRemaining <= 12) return ["12_hours"]
  if (hoursRemaining <= 24) return ["24_hours"]
  if (daysRemaining <= 3) return ["3_days"]
  if (daysRemaining <= 7) return ["7_days"]
  if (percentRemaining <= 25) return ["25_percent"]
  if (percentRemaining <= 50) return ["50_percent"]

  return []
}

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

async function tryRecordReminderPending(
  db: DatabaseConnection,
  secretId: string,
  reminderType: ReminderType,
  nextCheckIn: Date,
  checkInDays: number,
): Promise<{ success: boolean; id?: string }> {
  try {
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
      .onConflictDoNothing({
        target: [
          reminderJobs.secretId,
          reminderJobs.reminderType,
          reminderJobs.scheduledFor,
        ],
      })
      .returning({ id: reminderJobs.id })

    if (!inserted?.id) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[check-secrets] Reminder already exists: secretId=${secretId}, type=${reminderType}`,
        )
      }
      return { success: false }
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[check-secrets] Inserted pending reminder job with ID: ${inserted.id}`,
      )
    }

    return { success: true, id: inserted.id }
  } catch (error) {
    console.error(
      `[check-secrets] Error recording pending reminder:`,
      sanitizeError(error),
    )
    return { success: false }
  }
}

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
      })
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
      })
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
      db,
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

    const { url: checkInUrl } = await generateCheckInToken(db, secret.id)

    const result = await sendReminderEmail({
      userEmail: user.email,
      userName: user.name || user.email.split("@")[0],
      secretTitle: secret.title,
      daysRemaining,
      checkInUrl,
      urgencyLevel: urgency,
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

async function fetchSecretsWithReminders(
  db: DatabaseConnection,
  offset: number,
): Promise<SecretWithUserAndReminders[]> {
  const results = await db
    .select({
      secret: secrets,
      user: users,
      reminderId: reminderJobs.id,
      reminderType: reminderJobs.reminderType,
      reminderStatus: reminderJobs.status,
      reminderSentAt: reminderJobs.sentAt,
    })
    .from(secrets)
    .innerJoin(users, eq(secrets.userId, users.id))
    .leftJoin(
      reminderJobs,
      and(
        eq(reminderJobs.secretId, secrets.id),
        eq(reminderJobs.status, "sent"),
        gte(reminderJobs.sentAt, secrets.lastCheckIn),
      ),
    )
    .where(
      and(
        eq(secrets.status, "active"),
        isNotNull(secrets.serverShare),
        isNotNull(secrets.nextCheckIn),
      ),
    )
    .limit(CRON_CONFIG.BATCH_SIZE)
    .offset(offset)

  const secretsMap = new Map<string, SecretWithUserAndReminders>()

  for (const row of results) {
    const secretId = row.secret.id
    if (!secretsMap.has(secretId)) {
      secretsMap.set(secretId, {
        secret: row.secret,
        user: row.user,
        sentReminders: [],
      })
    }

    const secretData = secretsMap.get(secretId)!
    if (row.reminderType && row.reminderStatus === "sent") {
      secretData.sentReminders.push(row.reminderType as ReminderType)
    }
  }

  return Array.from(secretsMap.values())
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
    let remindersSkipped = 0
    let secretsProcessed = 0
    let offset = 0
    let hasMore = true

    while (hasMore && !isApproachingTimeout(startTime)) {
      const batchSecrets = await fetchSecretsWithReminders(db, offset)

      if (batchSecrets.length < CRON_CONFIG.BATCH_SIZE) {
        hasMore = false
      }

      for (const { secret, user, sentReminders } of batchSecrets) {
        if (isApproachingTimeout(startTime)) {
          console.log(
            `[check-secrets] Approaching timeout, stopping processing. Processed ${secretsProcessed} secrets`,
          )
          break
        }

        secretsProcessed++

        if (!secret.nextCheckIn || !secret.lastCheckIn) {
          console.warn(
            `[check-secrets] Secret ${secret.id} missing nextCheckIn or lastCheckIn - data integrity issue`,
          )
          continue
        }

        const nextCheckIn: Date = new Date(secret.nextCheckIn)
        const applicableTypes = getApplicableReminderTypes(
          nextCheckIn,
          secret.checkInDays,
        )

        if (process.env.NODE_ENV === "development") {
          console.log(
            `[check-secrets] Secret ${secret.id}: ${applicableTypes.length} applicable reminder types`,
          )
        }

        let remindersForThisSecret = 0

        for (const reminderType of applicableTypes) {
          if (
            isApproachingTimeout(startTime) ||
            remindersForThisSecret >=
              CRON_CONFIG.MAX_REMINDERS_PER_RUN_PER_SECRET
          ) {
            break
          }

          if (sentReminders.includes(reminderType)) {
            remindersSkipped++
            continue
          }

          remindersProcessed++
          remindersForThisSecret++

          const result = await processSecret(db, secret, user, reminderType)

          if (result.sent) {
            remindersSent++
          } else {
            remindersFailed++
          }
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
      remindersSkipped,
      retriesProcessed: retryStats.processed,
      retriesSent: retryStats.sent,
      retriesFailed: retryStats.failed,
      secretsProcessed,
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
