/**
 * Email Failure Logging Service
 *
 * Comprehensive logging infrastructure for email operation failures
 * Supports retry tracking, resolution management, and cleanup policies
 */

import { getDatabase } from "$lib/db/get-database"
import {
  emailFailures,
  type EmailFailure,
  type EmailFailureInsert,
} from "$lib/db/schema"
import { eq, and, lte, isNull, lt, sql } from "drizzle-orm"

/**
 * Log an email failure to the database
 */
export async function logEmailFailure(
  failureData: EmailFailureInsert,
): Promise<EmailFailure> {
  const db = await getDatabase()
  const [logged] = await db
    .insert(emailFailures)
    .values(failureData)
    .returning()
  return logged
}

/**
 * Increment retry count for a failed email
 */
export async function incrementRetryCount(
  failureId: string,
): Promise<EmailFailure> {
  const db = await getDatabase()
  // Use sql helper for atomic increment
  // Type assertion needed due to Drizzle type inference issue with .notNull().default() fields
  const [updated] = await db
    .update(emailFailures)
    .set({
      retryCount: sql`retry_count + 1`,
    } as any)
    .where(eq(emailFailures.id, failureId))
    .returning()

  if (!updated) {
    throw new Error(`Email failure ${failureId} not found`)
  }

  return updated
}

/**
 * Mark an email failure as resolved
 */
export async function resolveEmailFailure(
  failureId: string,
): Promise<EmailFailure> {
  const db = await getDatabase()
  const [resolved] = await db
    .update(emailFailures)
    .set({ resolvedAt: new Date() } as any)
    .where(eq(emailFailures.id, failureId))
    .returning()

  if (!resolved) {
    throw new Error(`Email failure ${failureId} not found`)
  }

  return resolved
}

/**
 * Get all unresolved email failures
 */
export async function getUnresolvedFailures(
  limit: number = 100,
): Promise<EmailFailure[]> {
  const db = await getDatabase()
  return await db
    .select()
    .from(emailFailures)
    .where(isNull(emailFailures.resolvedAt))
    .limit(limit)
}

/**
 * Get email failures by provider
 */
export async function getFailuresByProvider(
  provider: "sendgrid" | "console-dev" | "resend",
  limit: number = 100,
): Promise<EmailFailure[]> {
  const db = await getDatabase()
  return await db
    .select()
    .from(emailFailures)
    .where(eq(emailFailures.provider, provider))
    .limit(limit)
}

/**
 * Get email failures by type
 */
export async function getFailuresByType(
  emailType: "reminder" | "disclosure" | "admin_notification" | "verification",
  limit: number = 100,
): Promise<EmailFailure[]> {
  const db = await getDatabase()
  return await db
    .select()
    .from(emailFailures)
    .where(eq(emailFailures.emailType, emailType))
    .limit(limit)
}

/**
 * Cleanup old resolved email failures
 *
 * @param retentionDays - Number of days to retain resolved failures (default: 30)
 * @returns Number of deleted records
 */
export async function cleanupOldFailures(
  retentionDays: number = 30,
): Promise<number> {
  const db = await getDatabase()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const deleted = await db.delete(emailFailures).where(
    and(
      lt(emailFailures.createdAt, cutoffDate),
      // Only delete resolved failures
      eq(emailFailures.resolvedAt, emailFailures.resolvedAt),
    ),
  )

  // Drizzle returns { rowCount: number } or similar
  // Check the actual return value structure
  return typeof deleted === "object" && "rowCount" in deleted
    ? (deleted.rowCount as number) || 0
    : 0
}

/**
 * Get email failure statistics for admin dashboard
 */
export async function getFailureStats(): Promise<{
  total: number
  unresolved: number
  byProvider: Record<string, number>
  byType: Record<string, number>
}> {
  const db = await getDatabase()
  const allFailures = await db.select().from(emailFailures)
  const unresolvedFailures = allFailures.filter((f) => f.resolvedAt === null)

  const byProvider: Record<string, number> = {}
  const byType: Record<string, number> = {}

  for (const failure of allFailures) {
    byProvider[failure.provider] = (byProvider[failure.provider] || 0) + 1
    byType[failure.emailType] = (byType[failure.emailType] || 0) + 1
  }

  return {
    total: allFailures.length,
    unresolved: unresolvedFailures.length,
    byProvider,
    byType,
  }
}
