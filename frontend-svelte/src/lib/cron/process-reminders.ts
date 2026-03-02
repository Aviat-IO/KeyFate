/**
 * Core logic for the process-reminders cron job.
 *
 * Finds overdue secrets and sends disclosure emails to recipients.
 * Extracted from the route handler so the scheduler can call it directly
 * without self-invoking via HTTP loopback.
 */

import { logger } from "$lib/logger"
import { getDatabase } from "$lib/db/get-database"
import { getAllRecipients } from "$lib/db/queries/secrets"
import { secrets, users, disclosureLog } from "$lib/db/schema"
import type { Secret, SecretUpdate, User } from "$lib/db/schema"
import { sendAdminNotification } from "$lib/email/admin-notification-service"
import { logEmailFailure } from "$lib/email/email-failure-logger"
import { calculateBackoffDelay } from "$lib/email/email-retry-service"
import { sendSecretDisclosureEmail } from "$lib/email/email-service"
import { decryptMessage } from "$lib/encryption"
import { and, eq, lt, inArray, sql } from "drizzle-orm"
import {
  sanitizeError,
  CRON_CONFIG,
  isApproachingTimeout,
  logCronMetrics,
} from "$lib/cron/utils"
import {
  updateDisclosureLog,
  shouldRetrySecret,
} from "$lib/cron/disclosure-helpers"

export interface ProcessRemindersResult {
  processed: number
  succeeded: number
  failed: number
  totalSent: number
  totalFailed: number
  totalSecrets: number
  duration: number
  timestamp: string
}

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

      const delay = calculateBackoffDelay(attempt, baseDelay)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

async function processOverdueSecret(
  secret: Secret,
  user: User,
  startTimeMs: number,
): Promise<{
  success: boolean
  sent: number
  failed: number
  alreadyProcessing?: boolean
}> {
  const db = await getDatabase()

  try {
    if (!shouldRetrySecret(secret.retryCount)) {
      await db
        .update(secrets)
        .set({
          status: "failed",
          lastError: `Max retries (${CRON_CONFIG.MAX_SECRET_RETRIES}) exceeded`,
          updatedAt: new Date(),
        } as SecretUpdate)
        .where(eq(secrets.id, secret.id))

      return { success: false, sent: 0, failed: 0 }
    }

    const updated = await db
      .update(secrets)
      .set({
        status: "triggered",
        processingStartedAt: new Date(),
        updatedAt: new Date(),
      } as SecretUpdate)
      .where(and(eq(secrets.id, secret.id), eq(secrets.status, "active")))
      .returning({ id: secrets.id })

    if (updated.length === 0) {
      return { success: false, sent: 0, failed: 0, alreadyProcessing: true }
    }

    const recipients = await getAllRecipients(secret.id)

    if (recipients.length === 0) {
      await db
        .update(secrets)
        .set({
          status: "active",
          processingStartedAt: null,
          lastError: "No recipients configured",
          retryCount: secret.retryCount + 1,
          lastRetryAt: new Date(),
          updatedAt: new Date(),
        } as SecretUpdate)
        .where(eq(secrets.id, secret.id))

      return { success: false, sent: 0, failed: 0 }
    }

    // Use Buffer for secure memory handling of decrypted content
    let decryptedBuffer: Buffer | null = null

    try {
      const ivBuffer = Buffer.from(secret.iv || "", "base64")
      const authTagBuffer = Buffer.from(secret.authTag || "", "base64")
      const decryptedContent = await decryptMessage(
        secret.serverShare || "",
        ivBuffer,
        authTagBuffer,
        secret.keyVersion || 1,
      )

      // Store in Buffer instead of string for secure cleanup
      decryptedBuffer = Buffer.from(decryptedContent, "utf8")
    } catch {
      await db
        .update(secrets)
        .set({
          status: "active",
          processingStartedAt: null,
          lastError: "Decryption failed",
          retryCount: secret.retryCount + 1,
          lastRetryAt: new Date(),
          updatedAt: new Date(),
        } as SecretUpdate)
        .where(eq(secrets.id, secret.id))

      return { success: false, sent: 0, failed: 0 }
    }

    const recipientEmails = recipients
      .map((r) => r.email)
      .filter((email): email is string => !!email)

    const existingLogs = await db
      .select()
      .from(disclosureLog)
      .where(
        and(
          eq(disclosureLog.secretId, secret.id),
          inArray(disclosureLog.recipientEmail, recipientEmails),
          eq(disclosureLog.status, "sent"),
        ),
      )

    const sentEmails = new Set(existingLogs.map((log) => log.recipientEmail))

    let sent = sentEmails.size
    let failed = 0
    let timedOut = false

    try {
      for (const recipient of recipients) {
        if (isApproachingTimeout(startTimeMs)) {
          timedOut = true
          break
        }

        const contactEmail = recipient.email || ""
        if (!contactEmail) {
          continue
        }

        if (sentEmails.has(contactEmail)) {
          continue
        }

        let logEntry
        try {
          const inserted = await db
            .insert(disclosureLog)
            .values({
              secretId: secret.id,
              recipientEmail: contactEmail,
              recipientName: recipient.name,
            })
            .returning({ id: disclosureLog.id })
            .onConflictDoNothing()

          if (inserted.length === 0) {
            sent++
            continue
          }

          logEntry = inserted[0]
        } catch {
          sent++
          continue
        }

        try {
          const emailResult = await withRetry(
            async () => {
              return await sendSecretDisclosureEmail({
                contactEmail,
                contactName: recipient.name,
                secretTitle: secret.title,
                senderName: user.name || user.email,
                message: `This secret was scheduled for disclosure because the check-in deadline was missed.`,
                secretContent: decryptedBuffer!.toString("utf8"),
                disclosureReason: "scheduled",
                senderLastSeen: secret.lastCheckIn || undefined,
                secretCreatedAt: secret.createdAt || undefined,
              })
            },
            CRON_CONFIG.MAX_RETRIES,
            1000,
          )

          if (emailResult.success) {
            try {
              await updateDisclosureLog(db, logEntry.id, "sent")
              sent++
            } catch {
              sent++
            }
          } else {
            await updateDisclosureLog(
              db,
              logEntry.id,
              "failed",
              emailResult.error || "Unknown error",
            )

            await logEmailFailure({
              emailType: "disclosure",
              provider: (emailResult.provider || "sendgrid") as
                | "sendgrid"
                | "console-dev"
                | "resend",
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

          await updateDisclosureLog(db, logEntry.id, "failed", errorMsg)

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
    } finally {
      // Securely zero out the buffer
      if (decryptedBuffer) {
        decryptedBuffer.fill(0)
        decryptedBuffer = null
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
    }

    if (timedOut) {
      await db
        .update(secrets)
        .set({
          status: "active",
          processingStartedAt: null,
          lastError: `Timeout after sending ${sent}/${recipients.length} emails`,
          retryCount: secret.retryCount + 1,
          lastRetryAt: new Date(),
          updatedAt: new Date(),
        } as SecretUpdate)
        .where(eq(secrets.id, secret.id))

      return { success: false, sent, failed }
    }

    const allSent = sent === recipients.length && failed === 0
    const finalStatus = allSent ? "triggered" : "active"

    await db
      .update(secrets)
      .set({
        status: finalStatus as "triggered" | "active",
        triggeredAt: allSent ? new Date() : null,
        processingStartedAt: null,
        lastError: allSent ? null : `Sent: ${sent}, Failed: ${failed}`,
        retryCount: allSent ? secret.retryCount : secret.retryCount + 1,
        lastRetryAt: allSent ? null : new Date(),
        updatedAt: new Date(),
      } as SecretUpdate)
      .where(eq(secrets.id, secret.id))

    return { success: allSent, sent, failed }
  } catch (error) {
    const errorMsg = sanitizeError(error, secret.id)

    try {
      await db
        .update(secrets)
        .set({
          status: "active",
          processingStartedAt: null,
          lastError: errorMsg,
          retryCount: secret.retryCount + 1,
          lastRetryAt: new Date(),
          updatedAt: new Date(),
        } as SecretUpdate)
        .where(eq(secrets.id, secret.id))
    } catch {
      logger.error("Error rolling back secret status", undefined, {
        secretId: secret.id,
      })
    }

    return { success: false, sent: 0, failed: 0 }
  }
}

export async function runProcessReminders(): Promise<ProcessRemindersResult> {
  const startTime = Date.now()
  const startDate = new Date()
  logger.info("process-reminders cron job started", {
    timestamp: startDate.toISOString(),
  })

  const db = await getDatabase()

  const now = new Date()
  const nowIso = now.toISOString()

  // Fetch overdue secrets that are either:
  // 1. First attempt (retryCount = 0 or lastRetryAt is null), OR
  // 2. Past their exponential backoff window (lastRetryAt + backoff delay)
  const overdueSecrets = await db
    .select({
      secret: secrets,
      user: users,
    })
    .from(secrets)
    .innerJoin(users, eq(secrets.userId, users.id))
    .where(
      and(
        eq(secrets.status, "active"),
        lt(secrets.nextCheckIn, now),
        sql`(
            ${secrets.lastRetryAt} IS NULL 
            OR ${secrets.retryCount} = 0
            OR ${secrets.lastRetryAt} < ${nowIso}::timestamp - (
              INTERVAL '1 minute' * ${CRON_CONFIG.RETRY_BACKOFF_BASE_MINUTES} * 
              POW(${CRON_CONFIG.RETRY_BACKOFF_EXPONENT}, ${secrets.retryCount})
            )
          )`,
      ),
    )

  logger.info("Found overdue secrets", {
    count: overdueSecrets.length,
    withBackoff: process.env.NODE_ENV === "development",
  })

  let processed = 0
  let succeeded = 0
  let failedCount = 0
  let totalSent = 0
  let totalFailed = 0

  const queue = overdueSecrets.map((row) => ({
    secret: row.secret,
    user: row.user,
  }))
  const active = new Set<Promise<void>>()
  let warnedAboutTime = false

  while (queue.length > 0 || active.size > 0) {
    while (
      active.size < CRON_CONFIG.MAX_CONCURRENT_SECRETS &&
      queue.length > 0
    ) {
      const row = queue.shift()!
      const { secret, user } = row

      const promise = processOverdueSecret(secret, user, startTime)
        .then((result) => {
          if (!result.alreadyProcessing) {
            processed++
            totalSent += result.sent
            totalFailed += result.failed

            if (result.success) {
              succeeded++
            } else {
              failedCount++
            }
          }
        })
        .catch((error) => {
          logger.error("Worker error for secret", undefined, {
            secretId: secret.id,
            error: sanitizeError(error),
          })
          processed++
          failedCount++
        })
        .finally(() => {
          active.delete(promise)
        })

      active.add(promise)
    }

    if (active.size > 0) {
      await Promise.race(active)
    }

    const elapsed = Date.now() - startTime
    if (
      elapsed > CRON_CONFIG.CRON_INTERVAL_MS &&
      !warnedAboutTime &&
      queue.length > 0
    ) {
      logger.warn("Processing exceeds cron interval", {
        elapsedMs: elapsed,
        cronIntervalMs: CRON_CONFIG.CRON_INTERVAL_MS,
        remaining: queue.length,
      })
      warnedAboutTime = true
    }
  }

  const duration = Date.now() - startTime

  logCronMetrics("process-reminders", {
    duration,
    processed,
    succeeded,
    failed: failedCount,
  })

  return {
    processed,
    succeeded,
    failed: failedCount,
    totalSent,
    totalFailed,
    totalSecrets: overdueSecrets.length,
    duration,
    timestamp: new Date().toISOString(),
  }
}
