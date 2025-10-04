import { db } from "@/lib/db/drizzle";
import { secrets, users } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { decryptMessage } from "@/lib/encryption";
import { sendSecretDisclosureEmail, sendEmail } from "@/lib/email/email-service";
import { logEmailFailure } from "@/lib/email/email-failure-logger";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;

  return !!cronSecret && token === cronSecret;
}

/**
 * Implement exponential backoff retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Send admin notification for email failures
 */
async function sendAdminNotification(
  secretTitle: string,
  recipientEmail: string,
  errorMessage: string
): Promise<void> {
  try {
    await sendEmail({
      to: "support@aviat.io",
      subject: `Email Delivery Failure - ${secretTitle}`,
      html: `
        <h2>Email Delivery Failure</h2>
        <p><strong>Secret:</strong> ${secretTitle}</p>
        <p><strong>Recipient:</strong> ${recipientEmail}</p>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      text: `Email Delivery Failure\n\nSecret: ${secretTitle}\nRecipient: ${recipientEmail}\nError: ${errorMessage}\nTime: ${new Date().toISOString()}`,
      priority: "high",
    });
  } catch (error) {
    console.error("[process-reminders] Failed to send admin notification:", error);
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get overdue secrets
    const now = new Date();
    const overdueSecrets = await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, "active"),
          lt(secrets.nextCheckIn, now),
        ),
      );

    let processedCount = 0;

    // Process each overdue secret
    for (const secret of overdueSecrets) {
      try {
        // Get user information
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, secret.userId))
          .limit(1);

        if (!user) {
          console.error(`[process-reminders] User not found for secret ${secret.id}`);
          continue;
        }

        // Decrypt server share
        const ivBuffer = Buffer.from(secret.iv || "", "base64");
        const authTagBuffer = Buffer.from(secret.authTag || "", "base64");
        const decryptedContent = await decryptMessage(
          secret.serverShare || "",
          ivBuffer,
          authTagBuffer
        );

        // Send disclosure email with retry logic
        const emailResult = await withRetry(
          async () => {
            return await sendSecretDisclosureEmail({
              contactEmail: secret.recipientEmail || "",
              contactName: secret.recipientName,
              secretTitle: secret.title,
              senderName: user.name || user.email,
              message: `This secret was scheduled for disclosure because the check-in deadline was missed.`,
              secretContent: decryptedContent,
              disclosureReason: "scheduled",
              senderLastSeen: secret.lastCheckIn || undefined,
            });
          },
          3,
          1000
        );

        if (emailResult.success) {
          // Update secret status to triggered
          await db
            .update(secrets)
            .set({
              status: "triggered",
              triggeredAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(secrets.id, secret.id));

          processedCount++;
        } else {
          // Log email failure
          await logEmailFailure({
            emailType: "disclosure",
            provider: emailResult.provider as any || "sendgrid",
            recipient: secret.recipientEmail || "",
            subject: `Secret Disclosure: ${secret.title}`,
            errorMessage: emailResult.error || "Unknown error",
          });

          // Send admin notification for permanent failures
          if (!emailResult.retryable) {
            await sendAdminNotification(
              secret.title,
              secret.recipientEmail || "",
              emailResult.error || "Unknown error"
            );
          }
        }
      } catch (error) {
        console.error(`[process-reminders] Error processing secret ${secret.id}:`, error);

        // Log failure
        await logEmailFailure({
          emailType: "disclosure",
          provider: "sendgrid",
          recipient: secret.recipientEmail || "",
          subject: `Secret Disclosure: ${secret.title}`,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });

        // Send admin notification
        await sendAdminNotification(
          secret.title,
          secret.recipientEmail || "",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    return NextResponse.json({
      processed: processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[process-reminders] Error:", error);

    // Provide error information
    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
