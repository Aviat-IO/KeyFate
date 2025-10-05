/**
 * Dead Letter Queue
 *
 * Manages permanently failed emails with query interface, manual retry, and cleanup
 * Provides admin tools for email failure management and resolution
 */

import { db } from "@/lib/db/drizzle";
import { emailFailures, type EmailFailure } from "@/lib/db/schema";
import { eq, and, isNull, lt, desc } from "drizzle-orm";
import { EmailRetryService, type EmailFailureContext } from "./email-retry-service";

/**
 * Query options for dead letter queue
 */
export interface DeadLetterQueryOptions {
  emailType?: "reminder" | "disclosure" | "admin_notification" | "verification";
  provider?: "sendgrid" | "console-dev" | "resend";
  recipient?: string;
  unresolvedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Dead letter queue statistics
 */
export interface DeadLetterStats {
  total: number;
  unresolved: number;
  permanent: number;
  exhausted: number;
  byType: Record<string, number>;
  byProvider: Record<string, number>;
}

/**
 * Batch retry result
 */
export interface BatchRetryResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Dead Letter Queue
 *
 * Handles permanently failed emails and provides admin management interface
 */
export class DeadLetterQueue {
  private retryService: EmailRetryService;

  constructor() {
    this.retryService = new EmailRetryService();
  }

  /**
   * Query failed emails with filters
   *
   * @param options - Query options
   * @returns List of email failures
   */
  async queryFailures(options: DeadLetterQueryOptions = {}): Promise<EmailFailure[]> {
    const {
      emailType,
      provider,
      recipient,
      unresolvedOnly = false,
      limit = 100,
      offset = 0,
    } = options;

    // Build WHERE conditions
    const conditions: any[] = [];

    if (emailType) {
      conditions.push(eq(emailFailures.emailType, emailType));
    }

    if (provider) {
      conditions.push(eq(emailFailures.provider, provider));
    }

    if (recipient) {
      conditions.push(eq(emailFailures.recipient, recipient));
    }

    if (unresolvedOnly) {
      conditions.push(isNull(emailFailures.resolvedAt));
    }

    // Execute query with conditions
    let allFailures: EmailFailure[];

    if (conditions.length > 0) {
      allFailures = await db
        .select()
        .from(emailFailures)
        .where(and(...conditions));
    } else {
      allFailures = await db.select().from(emailFailures);
    }

    // Manual pagination
    return allFailures.slice(offset, offset + limit);
  }

  /**
   * Get dead letter queue statistics
   *
   * @returns Statistics about failed emails
   */
  async getStats(): Promise<DeadLetterStats> {
    const allFailures = await db.select().from(emailFailures);

    const unresolved = allFailures.filter((f) => !f.resolvedAt);

    // Count permanent failures (classified by error message)
    const { classifyFailure, getRetryLimitForEmailType } = await import(
      "./email-retry-service"
    );
    const permanent = unresolved.filter(
      (f) => classifyFailure(f.errorMessage) === "permanent"
    );

    // Count exhausted failures (retry limit reached)
    const exhausted = unresolved.filter((f) => {
      const limit = getRetryLimitForEmailType(f.emailType);
      return f.retryCount >= limit;
    });

    // Group by type
    const byType: Record<string, number> = {};
    for (const failure of allFailures) {
      byType[failure.emailType] = (byType[failure.emailType] || 0) + 1;
    }

    // Group by provider
    const byProvider: Record<string, number> = {};
    for (const failure of allFailures) {
      byProvider[failure.provider] = (byProvider[failure.provider] || 0) + 1;
    }

    return {
      total: allFailures.length,
      unresolved: unresolved.length,
      permanent: permanent.length,
      exhausted: exhausted.length,
      byType,
      byProvider,
    };
  }

  /**
   * Manually retry a single failed email
   *
   * @param failureId - Email failure ID
   * @param retryOperation - Function to retry the email send
   * @returns Retry result
   */
  async manualRetry(
    failureId: string,
    retryOperation: () => Promise<{ success: boolean; error?: string }>
  ) {
    return await this.retryService.retryFailure(failureId, retryOperation);
  }

  /**
   * Batch retry multiple failed emails
   *
   * @param failureIds - List of email failure IDs
   * @param retryOperationFactory - Function that creates retry operation for each failure
   * @returns Batch retry result
   */
  async batchRetry(
    failureIds: string[],
    retryOperationFactory: (
      failure: EmailFailureContext
    ) => Promise<{ success: boolean; error?: string }>
  ): Promise<BatchRetryResult> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const failureId of failureIds) {
      // Fetch failure context
      const [failure] = await db
        .select()
        .from(emailFailures)
        .where(eq(emailFailures.id, failureId))
        .limit(1);

      if (!failure) {
        errors.push({ id: failureId, error: "Failure not found" });
        failed++;
        continue;
      }

      const failureContext: EmailFailureContext = {
        id: failure.id,
        emailType: failure.emailType,
        provider: failure.provider,
        recipient: failure.recipient,
        subject: failure.subject,
        errorMessage: failure.errorMessage,
        retryCount: failure.retryCount,
        createdAt: failure.createdAt,
        resolvedAt: failure.resolvedAt,
      };

      const retryOperation = () => retryOperationFactory(failureContext);
      const result = await this.retryService.retryFailure(failureId, retryOperation);

      if (result.success) {
        successful++;
      } else {
        failed++;
        errors.push({
          id: failureId,
          error: result.error || "Unknown error",
        });
      }
    }

    return {
      total: failureIds.length,
      successful,
      failed,
      errors,
    };
  }

  /**
   * Mark a failed email as resolved without retry
   *
   * Used when admin manually resolves an issue or determines retry is not needed
   *
   * @param failureId - Email failure ID
   * @returns Updated failure record
   */
  async markResolved(failureId: string): Promise<EmailFailure> {
    const [resolved] = await db
      .update(emailFailures)
      .set({ resolvedAt: new Date() })
      .where(eq(emailFailures.id, failureId))
      .returning();

    if (!resolved) {
      throw new Error(`Email failure ${failureId} not found`);
    }

    return resolved;
  }

  /**
   * Cleanup old resolved email failures
   *
   * Removes resolved failures older than retention period
   *
   * @param retentionDays - Number of days to retain resolved failures (default: 30)
   * @returns Number of deleted records
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db
      .delete(emailFailures)
      .where(
        and(
          lt(emailFailures.createdAt, cutoffDate),
          // Only delete resolved failures
          eq(emailFailures.resolvedAt, emailFailures.resolvedAt)
        )
      );

    // Return count of deleted records
    return typeof result === "object" && "rowCount" in result
      ? result.rowCount || 0
      : 0;
  }

  /**
   * Get recent failures for a specific recipient
   *
   * Useful for debugging delivery issues for a specific email address
   *
   * @param recipient - Email address
   * @param limit - Maximum number of failures to return
   * @returns Recent failures for recipient
   */
  async getRecipientFailures(
    recipient: string,
    limit: number = 10
  ): Promise<EmailFailure[]> {
    const failures = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.recipient, recipient));

    // Sort by created date descending and limit
    return failures
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get failures by email type with retry eligibility
   *
   * @param emailType - Email type to filter
   * @returns Failures with retry eligibility flag
   */
  async getFailuresByType(emailType: "reminder" | "disclosure" | "admin_notification" | "verification") {
    const failures = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.emailType, emailType));

    const { classifyFailure, getRetryLimitForEmailType } = await import(
      "./email-retry-service"
    );

    return failures.map((failure) => {
      const classification = classifyFailure(failure.errorMessage);
      const retryLimit = getRetryLimitForEmailType(failure.emailType);
      const canRetry =
        !failure.resolvedAt &&
        classification === "transient" &&
        failure.retryCount < retryLimit;

      return {
        ...failure,
        classification,
        retryLimit,
        canRetry,
      };
    });
  }

  /**
   * Archive old failures to reduce table size
   *
   * Moves old resolved failures to archive table (if implemented)
   * For now, just returns count that would be archived
   *
   * @param archiveDays - Age threshold for archiving
   * @returns Count of failures eligible for archiving
   */
  async archiveOld(archiveDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveDays);

    const oldFailures = await db
      .select()
      .from(emailFailures)
      .where(
        and(
          lt(emailFailures.createdAt, cutoffDate),
          // Only archive resolved failures
          eq(emailFailures.resolvedAt, emailFailures.resolvedAt)
        )
      );

    // TODO: Implement actual archiving to separate table
    // For now, just return count
    return oldFailures.length;
  }
}
