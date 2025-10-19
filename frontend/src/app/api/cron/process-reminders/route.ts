import { getDatabase } from "@/lib/db/drizzle"
import { getAllRecipients } from "@/lib/db/queries/secrets"
import { secrets, users, disclosureLog } from "@/lib/db/schema"
import { sendAdminNotification } from "@/lib/email/admin-notification-service"
import { logEmailFailure } from "@/lib/email/email-failure-logger"
import { calculateBackoffDelay } from "@/lib/email/email-retry-service"
import { sendSecretDisclosureEmail } from "@/lib/email/email-service"
import { decryptMessage } from "@/lib/encryption"
import { and, eq, lt, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import {
  sanitizeError,
  authorizeRequest,
  CRON_CONFIG,
  isApproachingTimeout,
  logCronMetrics,
} from "@/lib/cron/utils"

export const dynamic = "force-dynamic"

/**
 * Enhanced retry logic using EmailRetryService
 * Falls back to legacy implementation if service unavailable
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) {
        throw lastError
      }

      // Use enhanced backoff calculation
      const delay = calculateBackoffDelay(attempt, baseDelay)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Process a single overdue secret with transaction-safe disclosure
 */
async function processOverdueSecret(
  secret: any,
  user: any,
  startTimeMs: number,
): Promise<{
  success: boolean
  sent: number
  failed: number
  alreadyProcessing?: boolean
}> {
  const db = await getDatabase()

  try {
    const updated = await db.execute<{ id: string }>(sql`
      UPDATE secrets
      SET 
        status = 'triggered',
        processing_started_at = ${new Date().toISOString()},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${secret.id} AND status = 'active'
      RETURNING id
    `)

    if (!updated || updated.length === 0) {
      console.log(
        `[process-reminders] Secret ${secret.id} already processing or not active`,
      )
      return { success: false, sent: 0, failed: 0, alreadyProcessing: true }
    }

    const recipients = await getAllRecipients(secret.id)

    if (recipients.length === 0) {
      console.error(
        `[process-reminders] No recipients found for secret ${secret.id}`,
      )
      await db.execute(sql`
        UPDATE secrets
        SET last_error = 'No recipients configured', updated_at = ${new Date().toISOString()}
        WHERE id = ${secret.id}
      `)
      return { success: false, sent: 0, failed: 0 }
    }

    let decryptedContent: string
    try {
      const ivBuffer = Buffer.from(secret.iv || "", "base64")
      const authTagBuffer = Buffer.from(secret.authTag || "", "base64")
      decryptedContent = await decryptMessage(
        secret.serverShare || "",
        ivBuffer,
        authTagBuffer,
      )
    } catch (error) {
      const errorMsg = sanitizeError(error, secret.id)
      console.error(`[process-reminders] Decryption failed:`, errorMsg)
      await db.execute(sql`
        UPDATE secrets
        SET last_error = 'Decryption failed', updated_at = ${new Date().toISOString()}
        WHERE id = ${secret.id}
      `)
      return { success: false, sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    for (const recipient of recipients) {
      if (isApproachingTimeout(startTimeMs)) {
        console.log(
          `[process-reminders] Approaching timeout, stopping disclosure for secret ${secret.id}`,
        )
        break
      }

      const contactEmail = recipient.email || ""
      if (!contactEmail) {
        console.error(
          `[process-reminders] Recipient ${recipient.id} has no email`,
        )
        continue
      }

      const existingLog = await db
        .select()
        .from(disclosureLog)
        .where(
          and(
            eq(disclosureLog.secretId, secret.id),
            eq(disclosureLog.recipientEmail, contactEmail),
            eq(disclosureLog.status, "sent"),
          ),
        )
        .limit(1)

      if (existingLog.length > 0) {
        console.log(
          `[process-reminders] Already sent to ${contactEmail} for secret ${secret.id}`,
        )
        sent++
        continue
      }

      const [logEntry] = await db
        .insert(disclosureLog)
        .values({
          secretId: secret.id,
          recipientEmail: contactEmail,
        })
        .returning({ id: disclosureLog.id })

      try {
        const emailResult = await withRetry(
          async () => {
            return await sendSecretDisclosureEmail({
              contactEmail,
              contactName: recipient.name,
              secretTitle: secret.title,
              senderName: user.name || user.email,
              message: `This secret was scheduled for disclosure because the check-in deadline was missed.`,
              secretContent: decryptedContent,
              disclosureReason: "scheduled",
              senderLastSeen: secret.lastCheckIn || undefined,
              secretCreatedAt: secret.createdAt || undefined,
            })
          },
          CRON_CONFIG.MAX_RETRIES,
          1000,
        )

        if (emailResult.success) {
          const now = new Date().toISOString()
          await db.execute(sql`
            UPDATE disclosure_log
            SET status = 'sent', sent_at = ${now}, updated_at = ${now}
            WHERE id = ${logEntry.id}
          `)
          sent++
        } else {
          const now = new Date().toISOString()
          await db.execute(sql`
            UPDATE disclosure_log
            SET 
              status = 'failed',
              error = ${emailResult.error || "Unknown error"},
              retry_count = COALESCE(retry_count, 0) + 1,
              updated_at = ${now}
            WHERE id = ${logEntry.id}
          `)

          await logEmailFailure({
            emailType: "disclosure",
            provider: (emailResult.provider as any) || "sendgrid",
            recipient: contactEmail,
            subject: `Secret Disclosure: ${secret.title}`,
            errorMessage: emailResult.error || "Unknown error",
          })

          await sendAdminNotification({
            emailType: "disclosure",
            recipient: contactEmail,
            errorMessage: emailResult.error || "Unknown error",
            secretTitle: secret.title,
            timestamp: new Date(),
          })

          failed++
        }
      } catch (error) {
        const errorMsg = sanitizeError(error, secret.id)
        console.error(
          `[process-reminders] Error sending to ${contactEmail}:`,
          errorMsg,
        )

        const now = new Date().toISOString()
        await db.execute(sql`
          UPDATE disclosure_log
          SET 
            status = 'failed',
            error = ${errorMsg},
            retry_count = COALESCE(retry_count, 0) + 1,
            updated_at = ${now}
          WHERE id = ${logEntry.id}
        `)

        await logEmailFailure({
          emailType: "disclosure",
          provider: "sendgrid",
          recipient: contactEmail,
          subject: `Secret Disclosure: ${secret.title}`,
          errorMessage: errorMsg,
        })

        failed++
      }
    }

    const allSent = sent > 0 && failed === 0
    const now = new Date().toISOString()
    const error = allSent ? null : `Sent: ${sent}, Failed: ${failed}`
    await db.execute(sql`
      UPDATE secrets
      SET 
        triggered_at = ${allSent ? now : null},
        last_error = ${error},
        updated_at = ${now}
      WHERE id = ${secret.id}
    `)

    return { success: allSent, sent, failed }
  } catch (error) {
    const errorMsg = sanitizeError(error, secret.id)
    console.error(`[process-reminders] Error processing secret:`, errorMsg)

    try {
      await db.execute(sql`
        UPDATE secrets
        SET 
          status = 'active',
          last_error = ${errorMsg},
          updated_at = ${new Date().toISOString()}
        WHERE id = ${secret.id}
      `)
    } catch (rollbackError) {
      console.error(
        `[process-reminders] Error rolling back:`,
        sanitizeError(rollbackError),
      )
    }

    return { success: false, sent: 0, failed: 0 }
  }
}

export async function POST(req: NextRequest) {
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const startDate = new Date()
  console.log(
    `[process-reminders] Cron job started at ${startDate.toISOString()}`,
  )

  try {
    const db = await getDatabase()

    const now = new Date()
    const overdueSecrets = await db
      .select({
        secret: secrets,
        user: users,
      })
      .from(secrets)
      .innerJoin(users, eq(secrets.userId, users.id))
      .where(and(eq(secrets.status, "active"), lt(secrets.nextCheckIn, now)))

    console.log(
      `[process-reminders] Found ${overdueSecrets.length} overdue secrets`,
    )

    let processed = 0
    let succeeded = 0
    let failed = 0
    let totalSent = 0
    let totalFailed = 0

    for (const row of overdueSecrets) {
      if (isApproachingTimeout(startTime)) {
        console.log(
          `[process-reminders] Approaching timeout, stopping. Processed ${processed}/${overdueSecrets.length}`,
        )
        break
      }

      const { secret, user } = row

      if (!user) {
        console.error(
          `[process-reminders] User not found for secret ${secret.id}`,
        )
        continue
      }

      processed++

      const result = await processOverdueSecret(secret, user, startTime)

      if (result.alreadyProcessing) {
        continue
      }

      totalSent += result.sent
      totalFailed += result.failed

      if (result.success) {
        succeeded++
      } else {
        failed++
      }
    }

    const duration = Date.now() - startTime

    logCronMetrics("process-reminders", {
      duration,
      processed,
      succeeded,
      failed,
    })

    return NextResponse.json({
      processed,
      succeeded,
      failed,
      totalSent,
      totalFailed,
      totalSecrets: overdueSecrets.length,
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[process-reminders] Error:", sanitizeError(error))

    const errorDetails = {
      error: "Database operation failed",
      message: sanitizeError(error),
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(errorDetails, { status: 500 })
  }
}
