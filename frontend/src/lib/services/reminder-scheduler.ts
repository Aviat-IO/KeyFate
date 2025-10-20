import { getDatabase } from "@/lib/db/drizzle"
import { reminderJobs } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"

export type ReminderType =
  | "1_hour"
  | "12_hours"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "25_percent"
  | "50_percent"

export function getAllReminderTypes(): ReminderType[] {
  return [
    "50_percent",
    "25_percent",
    "7_days",
    "3_days",
    "24_hours",
    "12_hours",
    "1_hour",
  ]
}

export function calculateScheduledFor(
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

export function getApplicableReminderTypes(
  nextCheckIn: Date,
  checkInDays: number,
): ReminderType[] {
  const now = new Date()
  const totalMs = nextCheckIn.getTime() - now.getTime()

  if (totalMs <= 0) {
    return []
  }

  const totalHours = checkInDays * 24
  const applicableTypes: ReminderType[] = []

  if (totalHours > 1) applicableTypes.push("1_hour")
  if (totalHours > 12) applicableTypes.push("12_hours")
  if (totalHours > 24) applicableTypes.push("24_hours")
  if (checkInDays > 3) applicableTypes.push("3_days")
  if (checkInDays > 7) applicableTypes.push("7_days")

  applicableTypes.push("25_percent")
  applicableTypes.push("50_percent")

  return applicableTypes
}

export async function cancelRemindersForSecret(
  secretId: string,
): Promise<number> {
  const db = await getDatabase()
  const now = new Date()

  const result = await db
    .update(reminderJobs)
    .set({
      status: "cancelled" as const,
      updatedAt: now,
    } as any)
    .where(
      and(
        eq(reminderJobs.secretId, secretId),
        eq(reminderJobs.status, "pending"),
      ),
    )
    .returning({ id: reminderJobs.id })

  const cancelledCount = result.length

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[reminder-scheduler] Cancelled ${cancelledCount} reminders for secret ${secretId}`,
    )
  }

  return cancelledCount
}

export async function scheduleRemindersForSecret(
  secretId: string,
  nextCheckIn: Date,
  checkInDays: number,
): Promise<{ scheduled: number; invalidated: number }> {
  const db = await getDatabase()
  const now = new Date()

  await db
    .update(reminderJobs)
    .set({
      status: "cancelled" as const,
      updatedAt: now,
    } as any)
    .where(
      and(
        eq(reminderJobs.secretId, secretId),
        eq(reminderJobs.status, "pending"),
      ),
    )

  const invalidatedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(reminderJobs)
    .where(
      and(
        eq(reminderJobs.secretId, secretId),
        eq(reminderJobs.status, "cancelled"),
      ),
    )

  const invalidatedCount =
    invalidatedResult.length > 0 ? Number(invalidatedResult[0].count) : 0

  const applicableTypes = getApplicableReminderTypes(nextCheckIn, checkInDays)
  let scheduledCount = 0

  for (const reminderType of applicableTypes) {
    const scheduledFor = calculateScheduledFor(
      reminderType,
      nextCheckIn,
      checkInDays,
    )

    if (scheduledFor <= now) {
      continue
    }

    try {
      const [inserted] = await db
        .insert(reminderJobs)
        .values({
          secretId,
          reminderType,
          scheduledFor,
          status: "pending",
        } as any)
        .onConflictDoNothing({
          target: [
            reminderJobs.secretId,
            reminderJobs.reminderType,
            reminderJobs.scheduledFor,
          ],
        })
        .returning({ id: reminderJobs.id })

      if (inserted?.id) {
        scheduledCount++

        if (process.env.NODE_ENV === "development") {
          console.log(
            `[reminder-scheduler] Scheduled ${reminderType} reminder for secret ${secretId} at ${scheduledFor.toISOString()}`,
          )
        }
      }
    } catch (error) {
      console.error(
        `[reminder-scheduler] Error scheduling ${reminderType} reminder for secret ${secretId}:`,
        error,
      )
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[reminder-scheduler] Scheduled ${scheduledCount} reminders, invalidated ${invalidatedCount} for secret ${secretId}`,
    )
  }

  return { scheduled: scheduledCount, invalidated: invalidatedCount }
}
