import { getDatabase } from "@/lib/db/drizzle";
import { secrets, checkInTokens, users, emailFailures, reminderJobs } from "@/lib/db/schema";
import { and, eq, isNotNull, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendReminderEmail } from "@/lib/email/email-service";
import { logEmailFailure } from "@/lib/email/email-failure-logger";
import { sendAdminNotification } from "@/lib/email/admin-notification-service";
import { randomBytes } from "crypto";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

// Type definition for reminder types
type ReminderType = '1_hour' | '12_hours' | '24_hours' | '3_days' | '7_days' | '25_percent' | '50_percent';

/**
 * Determine reminder type based on time remaining
 * Returns null if no reminder threshold is met
 */
function getReminderType(
  nextCheckIn: Date,
  checkInDays: number
): ReminderType | null {
  const now = new Date();
  const msRemaining = nextCheckIn.getTime() - now.getTime();

  // Return null for expired check-ins
  if (msRemaining <= 0) {
    return null;
  }

  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = hoursRemaining / 24;
  const totalHours = checkInDays * 24;
  const percentRemaining = (hoursRemaining / totalHours) * 100;

  // Critical: 1h before (highest priority)
  if (hoursRemaining <= 1) {
    return '1_hour';
  }

  // High urgency: 12h, 24h before
  if (hoursRemaining <= 12) {
    return '12_hours';
  }
  if (hoursRemaining <= 24) {
    return '24_hours';
  }

  // Medium urgency: 3d, 7d before
  if (daysRemaining <= 3) {
    return '3_days';
  }
  if (daysRemaining <= 7) {
    return '7_days';
  }

  // Low urgency: 25%, 50% of check-in period (lowest priority)
  if (percentRemaining <= 25) {
    return '25_percent';
  }
  if (percentRemaining <= 50) {
    return '50_percent';
  }

  return null;
}

/**
 * Check if a reminder has already been sent for this secret and reminder type
 */
async function hasReminderBeenSent(
  secretId: string,
  reminderType: ReminderType
): Promise<boolean> {
  try {
    const db = await getDatabase();

    console.log(`[check-secrets] Checking if reminder already sent: secretId=${secretId}, type=${reminderType}`);

    const existingReminder = await db.select()
      .from(reminderJobs)
      .where(
        and(
          eq(reminderJobs.secretId, secretId),
          eq(reminderJobs.reminderType, reminderType),
          eq(reminderJobs.status, 'sent')
        )
      )
      .limit(1);

    const alreadySent = existingReminder.length > 0;
    console.log(`[check-secrets] Reminder check result: alreadySent=${alreadySent}, found ${existingReminder.length} records`);

    return alreadySent;
  } catch (error) {
    console.error(`[check-secrets] Error checking reminder status:`, error);
    // On error, return false to allow sending (fail open)
    // This prevents blocking all reminders if there's a DB issue
    return false;
  }
}

/**
 * Record that a reminder was sent
 *
 * Note: We insert with default status ('pending') then update to 'sent' and set sentAt
 * This is a workaround for Drizzle type inference limitations
 */
async function recordReminderSent(
  secretId: string,
  reminderType: ReminderType
): Promise<void> {
  try {
    const db = await getDatabase();

    const now = new Date();

    console.log(`[check-secrets] Recording reminder sent: secretId=${secretId}, type=${reminderType}`);

    // Insert reminder job record (status defaults to 'pending')
    const [inserted] = await db.insert(reminderJobs).values({
      secretId,
      reminderType,
      scheduledFor: now,
    }).returning({ id: reminderJobs.id });

    if (!inserted?.id) {
      console.error(`[check-secrets] Failed to insert reminder job - no ID returned`);
      return;
    }

    console.log(`[check-secrets] Inserted reminder job with ID: ${inserted.id}`);

    // Update status to 'sent' and set sentAt timestamp
    await db.execute(sql`
      UPDATE reminder_jobs
      SET status = 'sent', sent_at = ${now.toISOString()}
      WHERE id = ${inserted.id}
    `);

    console.log(`[check-secrets] Updated reminder job status to 'sent' for ID: ${inserted.id}`);
  } catch (error) {
    console.error(`[check-secrets] Error recording reminder:`, error);
    throw error; // Re-throw to bubble up to caller
  }
}

/**
 * Authorization helper
 */
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
 * Calculate urgency level based on time remaining until nextCheckIn
 */
function calculateUrgency(
  nextCheckIn: Date,
): "critical" | "high" | "medium" | "low" {
  const now = new Date();
  const msRemaining = nextCheckIn.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (1000 * 60 * 60);

  if (hoursRemaining < 1) {
    return "critical";
  } else if (hoursRemaining < 24) {
    return "high";
  } else if (hoursRemaining < 24 * 7) {
    return "medium";
  } else {
    return "low";
  }
}

/**
 * Generate a secure check-in token and URL
 */
async function generateCheckInToken(
  secretId: string,
): Promise<{ token: string; url: string }> {
  const db = await getDatabase();

  // Generate secure random token
  const token = randomBytes(32).toString("hex");

  // Token expires in 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Store token in database
  await db.insert(checkInTokens).values({
    secretId,
    token,
    expiresAt,
  });

  // Generate check-in URL
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/check-in?token=${token}`;

  return { token, url };
}

/**
 * Process a single secret for reminder sending
 */
async function processSecret(
  secret: any,
  user: any,
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Calculate urgency
    const urgency = calculateUrgency(new Date(secret.nextCheckIn));

    // Calculate days remaining
    const now = new Date();
    const msRemaining = new Date(secret.nextCheckIn).getTime() - now.getTime();
    const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24));

    // Generate check-in token and URL
    const { url: checkInUrl } = await generateCheckInToken(secret.id);

    // Send reminder email
    const result = await sendReminderEmail({
      userEmail: user.email,
      userName: user.name || user.email.split("@")[0],
      secretTitle: secret.title,
      daysRemaining,
      checkInUrl,
      urgencyLevel: urgency,
    });

    if (!result.success) {
      // Log failure to email_failures table
      const db = await getDatabase();
      await logEmailFailure({
        emailType: "reminder",
        provider: (result.provider as "sendgrid" | "console-dev" | "resend") || "sendgrid",
        recipient: user.email,
        subject: `Check-in Reminder: ${secret.title}`,
        errorMessage: result.error || "Unknown error",
      });

      // Check retry count for this recipient/secret combination
      const recentFailures = await db.select()
        .from(emailFailures)
        .where(
          and(
            eq(emailFailures.emailType, "reminder"),
            eq(emailFailures.recipient, user.email)
          )
        )
        .orderBy(desc(emailFailures.createdAt))
        .limit(5);

      const retryCount = recentFailures.reduce((sum, f) => sum + f.retryCount, 0);

      // Send admin notification if retry count exceeds threshold (>3 retries)
      if (retryCount > 3) {
        await sendAdminNotification({
          emailType: "reminder",
          recipient: user.email,
          errorMessage: result.error || "Unknown error",
          secretTitle: secret.title,
          timestamp: new Date(),
          retryCount,
        });
      }

      return {
        sent: false,
        error: result.error,
      };
    }

    return { sent: true };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";

    console.error(
      `[check-secrets] Failed to process secret ${secret.id}:`,
      error,
    );

    return {
      sent: false,
      error: errorMessage,
    };
  }
}

/**
 * Main cron job handler
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = new Date();
  console.log(`[check-secrets] Cron job started at ${startTime.toISOString()}`);

  try {
    const db = await getDatabase();

    // Debug: Check if reminder_jobs table has any records
    const existingReminderCount = await db.select({ count: sql<number>`count(*)` })
      .from(reminderJobs);
    console.log(`[check-secrets] Existing reminder_jobs count: ${existingReminderCount[0]?.count || 0}`);

    // Query all active secrets with server shares
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
      );

    console.log(`[check-secrets] Found ${allActiveSecrets.length} active secrets to process`);

    let remindersProcessed = 0;
    let remindersSent = 0;
    let remindersFailed = 0;

    // Process each secret
    for (const row of allActiveSecrets) {
      const { secret, user } = row;

      console.log(`[check-secrets] Processing secret ${secret.id} (title: ${secret.title})`);

      // Determine reminder type based on time remaining
      const reminderType = getReminderType(new Date(secret.nextCheckIn!), secret.checkInDays);

      console.log(`[check-secrets] Reminder type for secret ${secret.id}: ${reminderType || 'none'}`);

      // Check if we should send a reminder
      if (reminderType) {
        // Check if this reminder type has already been sent
        const alreadySent = await hasReminderBeenSent(secret.id, reminderType);

        if (alreadySent) {
          console.log(`[check-secrets] Skipping reminder for secret ${secret.id} - already sent ${reminderType}`);
        } else {
          console.log(`[check-secrets] Sending reminder for secret ${secret.id} - type: ${reminderType}`);
          remindersProcessed++;

          const result = await processSecret(secret, user);

          if (result.sent) {
            // Record that we sent this reminder
            try {
              await recordReminderSent(secret.id, reminderType);
              remindersSent++;
              console.log(`[check-secrets] Successfully recorded reminder for secret ${secret.id}`);
            } catch (recordError) {
              console.error(
                `[check-secrets] Failed to record reminder for secret ${secret.id}:`,
                recordError
              );
              // Continue processing even if recording fails
            }
          } else {
            remindersFailed++;
            console.error(
              `[check-secrets] Failed to send reminder for secret ${secret.id}: ${result.error}`,
            );
          }
        }
      }
    }

    return NextResponse.json({
      remindersProcessed,
      remindersSent,
      remindersFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[check-secrets] Error:", error);

    const errorDetails = {
      error: "Database operation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
