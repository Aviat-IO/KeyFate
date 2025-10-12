import { getDatabase } from "@/lib/db/drizzle"
import { getAllRecipients } from "@/lib/db/queries/secrets"
import { secrets, users } from "@/lib/db/schema"
import { sendAdminNotification } from "@/lib/email/admin-notification-service"
import { logEmailFailure } from "@/lib/email/email-failure-logger"
import { calculateBackoffDelay } from "@/lib/email/email-retry-service"
import { sendSecretDisclosureEmail } from "@/lib/email/email-service"
import { decryptMessage } from "@/lib/encryption"
import { and, eq, lt } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

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

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await getDatabase()

    // Get overdue secrets
    const now = new Date()
    const overdueSecrets = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.status, "active"), lt(secrets.nextCheckIn, now)))

    let processedCount = 0

    // Process each overdue secret
    for (const secret of overdueSecrets) {
      try {
        // Get user information
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, secret.userId))
          .limit(1)

        if (!user) {
          console.error(
            `[process-reminders] User not found for secret ${secret.id}`,
          )
          continue
        }

        // Get all recipients for this secret
        const recipients = await getAllRecipients(secret.id)

        if (recipients.length === 0) {
          console.error(
            `[process-reminders] No recipients found for secret ${secret.id}`,
          )
          continue
        }

        // Decrypt server share
        const ivBuffer = Buffer.from(secret.iv || "", "base64")
        const authTagBuffer = Buffer.from(secret.authTag || "", "base64")
        const decryptedContent = await decryptMessage(
          secret.serverShare || "",
          ivBuffer,
          authTagBuffer,
        )

        // Send disclosure email to all recipients
        let allEmailsSucceeded = true
        for (const recipient of recipients) {
          const contactEmail = recipient.email || ""
          if (!contactEmail) {
            console.error(
              `[process-reminders] Recipient ${recipient.id} has no contact info`,
            )
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
                  secretContent: decryptedContent,
                  disclosureReason: "scheduled",
                  senderLastSeen: secret.lastCheckIn || undefined,
                })
              },
              3,
              1000,
            )

            if (!emailResult.success) {
              allEmailsSucceeded = false

              // Log email failure
              await logEmailFailure({
                emailType: "disclosure",
                provider: (emailResult.provider as any) || "sendgrid",
                recipient: contactEmail,
                subject: `Secret Disclosure: ${secret.title}`,
                errorMessage: emailResult.error || "Unknown error",
              })

              // Send admin notification for critical failures
              await sendAdminNotification({
                emailType: "disclosure",
                recipient: contactEmail,
                errorMessage: emailResult.error || "Unknown error",
                secretTitle: secret.title,
                timestamp: new Date(),
              })
            }
          } catch (error) {
            allEmailsSucceeded = false
            console.error(
              `[process-reminders] Error sending to recipient ${recipient.id}:`,
              error,
            )

            // Log failure
            await logEmailFailure({
              emailType: "disclosure",
              provider: "sendgrid",
              recipient: contactEmail,
              subject: `Secret Disclosure: ${secret.title}`,
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            })

            // Send admin notification
            await sendAdminNotification({
              emailType: "disclosure",
              recipient: contactEmail,
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
              secretTitle: secret.title,
              timestamp: new Date(),
            })
          }
        }

        // Update secret status if at least one email succeeded
        if (allEmailsSucceeded) {
          await db
            .update(secrets)
            .set({
              status: "triggered",
              triggeredAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(secrets.id, secret.id))

          processedCount++
        }
      } catch (error) {
        console.error(
          `[process-reminders] Error processing secret ${secret.id}:`,
          error,
        )
      }
    }

    return NextResponse.json({
      processed: processedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[process-reminders] Error:", error)

    // Provide error information
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(errorDetails, { status: 500 })
  }
}
