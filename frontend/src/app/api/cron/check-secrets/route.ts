import { getDatabase } from "@/lib/db/drizzle"
import {
  secrets,
  checkInTokens,
  users,
  emailFailures,
  reminderJobs,
} from "@/lib/db/schema"
import { and, eq, isNotNull, desc, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { sendReminderEmail } from "@/lib/email/email-service"
import { logEmailFailure } from "@/lib/email/email-failure-logger"
import { sendAdminNotification } from "@/lib/email/admin-notification-service"
import { randomBytes } from "crypto"

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
 * Determine reminder type based on time remaining
 * Returns null if no reminder threshold is met
 */
function getReminderType(
  nextCheckIn: Date,
  checkInDays: number,
): ReminderType | null {
  const now = new Date()
  const msRemaining = nextCheckIn.getTime() - now.getTime()

  // Return null for expired check-ins
  if (msRemaining <= 0) {
    return null
  }

  const hoursRemaining = msRemaining / (1000 * 60 * 60)
  const daysRemaining = hoursRemaining / 24
  const totalHours = checkInDays * 24
  const percentRemaining = (hoursRemaining / totalHours) * 100

  // Critical: 1h before (highest priority)
  if (hoursRemaining <= 1) {
    return "1_hour"
  }

  // High urgency: 12h, 24h before
  if (hoursRemaining <= 12) {
    return "12_hours"
  }
  if (hoursRemaining <= 24) {
    return "24_hours"
  }

  // Medium urgency: 3d, 7d before
  if (daysRemaining <= 3) {
    return "3_days"
  }
  if (daysRemaining <= 7) {
    return "7_days"
  }

  // Low urgency: 25%, 50% of check-in period (lowest priority)
  if (percentRemaining <= 25) {
    return "25_percent"
  }
  if (percentRemaining <= 50) {
    return "50_percent"
  }

  return null
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
 * Record that a reminder was sent
 *
 * BUG FIX #2: Now accepts checkInDays parameter to calculate proper scheduledFor
 * for percentage-based reminders (25%, 50%)
 *
 * BUG FIX #4: Insert with status='pending' BEFORE email send to ensure idempotency
 */
async function recordReminderSent(
  secretId: string,
  reminderType: ReminderType,
  nextCheckIn: Date,
  checkInDays: number,
): Promise<void> {
  try {
    const db = await getDatabase()

    const now = new Date()

    console.log(
      `[check-secrets] Recording reminder sent: secretId=${secretId}, type=${reminderType}`,
    )

    // Calculate when this reminder should have been scheduled
    // scheduledFor = nextCheckIn - reminder threshold
    let scheduledFor: Date
    const checkInTime = nextCheckIn.getTime()

    switch (reminderType) {
      case "1_hour":
        scheduledFor = new Date(checkInTime - 1 * 60 * 60 * 1000)
        break
      case "12_hours":
        scheduledFor = new Date(checkInTime - 12 * 60 * 60 * 1000)
        break
      case "24_hours":
        scheduledFor = new Date(checkInTime - 24 * 60 * 60 * 1000)
        break
      case "3_days":
        scheduledFor = new Date(checkInTime - 3 * 24 * 60 * 60 * 1000)
        break
      case "7_days":
        scheduledFor = new Date(checkInTime - 7 * 24 * 60 * 60 * 1000)
        break
      case "25_percent":
        scheduledFor = new Date(
          checkInTime - checkInDays * 24 * 60 * 60 * 1000 * 0.75,
        )
        break
      case "50_percent":
        scheduledFor = new Date(
          checkInTime - checkInDays * 24 * 60 * 60 * 1000 * 0.5,
        )
        break
    }

    console.log(
      `[check-secrets] Calculated scheduledFor: ${scheduledFor.toISOString()} for ${reminderType} reminder (nextCheckIn: ${nextCheckIn.toISOString()})`,
    )

    // Status defaults to 'pending' in the schema
    const [inserted] = await db
      .insert(reminderJobs)
      .values({
        secretId,
        reminderType,
        scheduledFor,
      })
      .returning({ id: reminderJobs.id })

    if (!inserted?.id) {
      console.error(
        `[check-secrets] Failed to insert reminder job - no ID returned`,
      )
      return
    }

    console.log(
      `[check-secrets] Inserted reminder job with ID: ${inserted.id} (status: pending)`,
    )

    // Update status to 'sent' and set sentAt timestamp
    await db.execute(sql`
      UPDATE reminder_jobs
      SET status = 'sent', sent_at = ${now.toISOString()}
      WHERE id = ${inserted.id}
    `)

    console.log(
      `[check-secrets] Updated reminder job status to 'sent' for ID: ${inserted.id}`,
    )
  } catch (error) {
    console.error(`[check-secrets] Error recording reminder:`, error)
    throw error // Re-throw to bubble up to caller
  }
}

/**
 * Authorization helper
 */
function authorize(req: NextRequest): boolean {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization")

  if (!header?.startsWith("Bearer ")) {
    return false
  }

  const token = header.slice(7).trim()
  const cronSecret = process.env.CRON_SECRET

  return !!cronSecret && token === cronSecret
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
 * Process a single secret for reminder sending
 */
async function processSecret(
  secret: any,
  user: any,
  reminderType: ReminderType,
): Promise<{ sent: boolean; error?: string; recordedPending?: boolean }> {
  try {
    // BUG FIX #5: Type-safe check for nextCheckIn
    if (!secret.nextCheckIn) {
      console.warn(
        `[check-secrets] Secret ${secret.id} missing nextCheckIn, skipping`,
      )
      return { sent: false, error: "missing_next_check_in" }
    }

    const nextCheckIn: Date = new Date(secret.nextCheckIn)

    // This ensures idempotency - if send fails, pending record prevents duplicate retry
    try {
      await recordReminderSent(
        secret.id,
        reminderType,
        nextCheckIn,
        secret.checkInDays,
      )
      console.log(
        `[check-secrets] Recorded pending reminder for secret ${secret.id}`,
      )
    } catch (recordError) {
      console.error(
        `[check-secrets] Failed to record pending reminder:`,
        recordError,
      )
      return {
        sent: false,
        error: "failed_to_record_pending",
        recordedPending: false,
      }
    }

    // Calculate urgency
    const urgency = calculateUrgency(nextCheckIn)

    // Calculate days remaining
    const now = new Date()
    const msRemaining = nextCheckIn.getTime() - now.getTime()
    const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24))

    // Generate check-in token and URL
    const { url: checkInUrl } = await generateCheckInToken(secret.id)

    // Send reminder email
    const result = await sendReminderEmail({
      userEmail: user.email,
      userName: user.name || user.email.split("@")[0],
      secretTitle: secret.title,
      daysRemaining,
      checkInUrl,
      urgencyLevel: urgency,
    })

    if (!result.success) {
      // Log failure to email_failures table
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

      // Check retry count for this recipient/secret combination
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

      // Send admin notification if retry count exceeds threshold (>3 retries)
      if (retryCount > 3) {
        await sendAdminNotification({
          emailType: "reminder",
          recipient: user.email,
          errorMessage: result.error || "Unknown error",
          secretTitle: secret.title,
          timestamp: new Date(),
          retryCount,
        })
      }

      return {
        sent: false,
        error: result.error,
        recordedPending: true,
      }
    }

    return { sent: true, recordedPending: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    console.error(
      `[check-secrets] Failed to process secret ${secret.id}:`,
      error,
    )

    return {
      sent: false,
      error: errorMessage,
    }
  }
}

/**
 * Main cron job handler
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = new Date()
  console.log(`[check-secrets] Cron job started at ${startTime.toISOString()}`)

  try {
    const db = await getDatabase()

    // Debug: Check if reminder_jobs table has any records
    const existingReminderCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(reminderJobs)
    console.log(
      `[check-secrets] Existing reminder_jobs count: ${existingReminderCount[0]?.count || 0}`,
    )

    // Query all active secrets with server shares (excluding triggered)
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

    // Process each secret
    for (const row of allActiveSecrets) {
      const { secret, user } = row

      console.log(
        `[check-secrets] Processing secret ${secret.id} (title: ${secret.title})`,
      )

      // BUG FIX #5: Type-safe null check for nextCheckIn
      if (!secret.nextCheckIn) {
        console.warn(
          `[check-secrets] Secret ${secret.id} missing nextCheckIn, skipping`,
        )
        continue
      }

      // BUG FIX #5: Type-safe null check for lastCheckIn
      if (!secret.lastCheckIn) {
        console.warn(
          `[check-secrets] Secret ${secret.id} missing lastCheckIn, skipping`,
        )
        continue
      }

      // Determine reminder type based on time remaining
      const nextCheckIn: Date = new Date(secret.nextCheckIn)
      const lastCheckIn: Date = new Date(secret.lastCheckIn)
      const reminderType = getReminderType(nextCheckIn, secret.checkInDays)

      console.log(
        `[check-secrets] Reminder type for secret ${secret.id}: ${reminderType || "none"}`,
      )

      // Check if we should send a reminder
      if (reminderType) {
        const alreadySent = await hasReminderBeenSent(
          secret.id,
          reminderType,
          lastCheckIn,
        )

        if (alreadySent) {
          console.log(
            `[check-secrets] Skipping reminder for secret ${secret.id} - already sent ${reminderType} in current period`,
          )
        } else {
          console.log(
            `[check-secrets] Sending reminder for secret ${secret.id} - type: ${reminderType}`,
          )
          remindersProcessed++

          const result = await processSecret(secret, user, reminderType)

          if (result.sent) {
            remindersSent++
            console.log(
              `[check-secrets] Successfully sent and recorded reminder for secret ${secret.id}`,
            )
          } else {
            remindersFailed++
            console.error(
              `[check-secrets] Failed to send reminder for secret ${secret.id}: ${result.error}`,
            )
          }
        }
      }
    }

    return NextResponse.json({
      remindersProcessed,
      remindersSent,
      remindersFailed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[check-secrets] Error:", error)

    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(errorDetails, { status: 500 })
  }
}
