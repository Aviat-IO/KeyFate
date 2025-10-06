/**
 * Test script to verify reminder deduplication logic
 * Run with: npx tsx __tests__/api/cron/test-deduplication.ts
 */

import { getDatabase } from "@/lib/db/drizzle";
import { reminderJobs, secrets } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

type ReminderType = '1_hour' | '12_hours' | '24_hours' | '3_days' | '7_days' | '25_percent' | '50_percent';

async function hasReminderBeenSent(
  secretId: string,
  reminderType: ReminderType
): Promise<boolean> {
  const db = await getDatabase();

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

  return existingReminder.length > 0;
}

async function recordReminderSent(
  secretId: string,
  reminderType: ReminderType
): Promise<void> {
  const db = await getDatabase();
  const now = new Date();

  // Insert reminder job record (status defaults to 'pending')
  const [inserted] = await db.insert(reminderJobs).values({
    secretId,
    reminderType,
    scheduledFor: now,
  }).returning({ id: reminderJobs.id });

  // Update status to 'sent' and set sentAt timestamp
  if (inserted?.id) {
    await db.execute(sql`
      UPDATE reminder_jobs
      SET status = 'sent', sent_at = ${now}
      WHERE id = ${inserted.id}
    `);
  }
}

async function main() {
  console.log("Testing reminder deduplication logic...\n");

  const db = await getDatabase();

  // Get first active secret
  const [testSecret] = await db.select()
    .from(secrets)
    .where(eq(secrets.status, 'active'))
    .limit(1);

  if (!testSecret) {
    console.error("No active secrets found in database");
    process.exit(1);
  }

  const testReminderType: ReminderType = '24_hours';

  console.log(`Test secret ID: ${testSecret.id}`);
  console.log(`Test reminder type: ${testReminderType}\n`);

  // Check 1: Should not exist yet
  console.log("Check 1: Checking if reminder exists (should be false)...");
  const check1 = await hasReminderBeenSent(testSecret.id, testReminderType);
  console.log(`Result: ${check1}\n`);

  if (check1) {
    console.log("⚠️  Reminder already exists. Cleaning up first...");
    await db.delete(reminderJobs)
      .where(
        and(
          eq(reminderJobs.secretId, testSecret.id),
          eq(reminderJobs.reminderType, testReminderType)
        )
      );
    console.log("Cleanup complete.\n");
  }

  // Record a reminder
  console.log("Step 1: Recording reminder as sent...");
  await recordReminderSent(testSecret.id, testReminderType);
  console.log("✓ Reminder recorded\n");

  // Check 2: Should exist now
  console.log("Check 2: Checking if reminder exists (should be true)...");
  const check2 = await hasReminderBeenSent(testSecret.id, testReminderType);
  console.log(`Result: ${check2}\n`);

  if (!check2) {
    console.error("❌ FAILURE: Reminder was not found after recording!");

    // Debug: Check what's actually in the table
    console.log("\nDebug: Querying reminder_jobs table...");
    const allReminders = await db.select()
      .from(reminderJobs)
      .where(eq(reminderJobs.secretId, testSecret.id));

    console.log(`Found ${allReminders.length} reminders for this secret:`);
    allReminders.forEach((r, i) => {
      console.log(`  ${i + 1}. ID: ${r.id}, Type: ${r.reminderType}, Status: ${r.status}, SentAt: ${r.sentAt}`);
    });

    process.exit(1);
  }

  // Check 3: Different type should not exist
  console.log("Check 3: Checking if different reminder type exists (should be false)...");
  const check3 = await hasReminderBeenSent(testSecret.id, '1_hour');
  console.log(`Result: ${check3}\n`);

  if (check3) {
    console.error("❌ FAILURE: Found wrong reminder type!");
    process.exit(1);
  }

  // Cleanup
  console.log("Cleanup: Removing test reminder...");
  await db.delete(reminderJobs)
    .where(
      and(
        eq(reminderJobs.secretId, testSecret.id),
        eq(reminderJobs.reminderType, testReminderType)
      )
    );
  console.log("✓ Cleanup complete\n");

  console.log("✅ ALL TESTS PASSED - Deduplication logic works correctly!");
}

main().catch((error) => {
  console.error("Error running test:", error);
  process.exit(1);
});
