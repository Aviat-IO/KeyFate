import { getDatabase } from "@/lib/db/drizzle";
import { secrets, checkInTokens, users } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendReminderEmail } from "@/lib/email/email-service";
import { logEmailFailure } from "@/lib/email/email-failure-logger";
import { randomBytes } from "crypto";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

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
 * Determine if a reminder should be sent based on interval thresholds
 * Reminder intervals: 25%, 50%, 7d, 3d, 24h, 12h, 1h
 */
function shouldSendReminder(
  nextCheckIn: Date,
  checkInDays: number,
): boolean {
  const now = new Date();
  const msRemaining = nextCheckIn.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = hoursRemaining / 24;
  const totalHours = checkInDays * 24;

  // Calculate percentage remaining
  const percentRemaining = (hoursRemaining / totalHours) * 100;

  // Send reminders at specific intervals
  // Critical: 1h before
  if (hoursRemaining <= 1 && hoursRemaining > 0) {
    return true;
  }

  // High urgency: 12h, 24h before
  if (
    (hoursRemaining <= 12 && hoursRemaining > 11) ||
    (hoursRemaining <= 24 && hoursRemaining > 23)
  ) {
    return true;
  }

  // Medium urgency: 3d, 7d before
  if (
    (daysRemaining <= 3 && daysRemaining > 2.9) ||
    (daysRemaining <= 7 && daysRemaining > 6.9)
  ) {
    return true;
  }

  // Low urgency: 25%, 50% of check-in period
  if (
    (percentRemaining <= 50 && percentRemaining > 49) ||
    (percentRemaining <= 25 && percentRemaining > 24)
  ) {
    return true;
  }

  return false;
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
      await logEmailFailure({
        emailType: "reminder",
        provider: (result.provider as "sendgrid" | "console-dev" | "resend") || "sendgrid",
        recipient: user.email,
        subject: `Check-in Reminder: ${secret.title}`,
        errorMessage: result.error || "Unknown error",
      });

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

  try {
    const db = await getDatabase();

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

    let remindersProcessed = 0;
    let remindersSent = 0;
    let remindersFailed = 0;

    // Process each secret
    for (const row of allActiveSecrets) {
      const { secret, user } = row;

      // Check if reminder should be sent based on intervals
      if (shouldSendReminder(new Date(secret.nextCheckIn!), secret.checkInDays)) {
        remindersProcessed++;

        const result = await processSecret(secret, user);

        if (result.sent) {
          remindersSent++;
        } else {
          remindersFailed++;
          console.error(
            `[check-secrets] Failed to send reminder for secret ${secret.id}: ${result.error}`,
          );
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
