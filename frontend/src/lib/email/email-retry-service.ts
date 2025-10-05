/**
 * Email Retry Service
 *
 * Sophisticated retry logic with exponential backoff, jitter, and failure classification
 * Supports configurable retry limits per email type and integration with dead letter queue
 */

import { db } from "@/lib/db/drizzle";
import { emailFailures, type EmailFailure } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Email failure context for retry operations
 */
export interface EmailFailureContext {
  id: string;
  emailType: "reminder" | "disclosure" | "admin_notification" | "verification";
  provider: "sendgrid" | "console-dev" | "resend";
  recipient: string;
  subject: string;
  errorMessage: string;
  retryCount: number;
  createdAt: Date;
  resolvedAt?: Date | null;
}

/**
 * Failure classification types
 */
export type FailureClassification = "transient" | "permanent";

/**
 * Retry result
 */
export interface RetryResult {
  success: boolean;
  error?: string;
  exhausted?: boolean; // Retry limit reached
  permanent?: boolean; // Permanent failure, no retry
  nextRetryAt?: Date;
}

/**
 * Retry limits per email type
 * - disclosure: 5 retries (critical)
 * - reminder: 3 retries (important)
 * - verification: 2 retries (standard)
 * - admin_notification: 1 retry (low priority)
 */
const RETRY_LIMITS: Record<string, number> = {
  disclosure: 5,
  reminder: 3,
  verification: 2,
  admin_notification: 1,
};

/**
 * Base delay for exponential backoff (milliseconds)
 */
const BASE_DELAY_MS = 1000;

/**
 * Maximum delay for exponential backoff (milliseconds)
 */
const MAX_DELAY_MS = 60000; // 1 minute

/**
 * Jitter factor (50% of base delay)
 */
const JITTER_FACTOR = 0.5;

/**
 * Get retry limit for email type
 */
export function getRetryLimitForEmailType(
  emailType: "reminder" | "disclosure" | "admin_notification" | "verification"
): number {
  return RETRY_LIMITS[emailType] || 1;
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: delay = min(2^attempt * baseDelay, maxDelay) + jitter
 * Jitter: random(0, baseDelay * jitterFactor)
 *
 * @param attempt - Retry attempt number (1-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap
 * @returns Delay in milliseconds with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = BASE_DELAY_MS,
  maxDelay: number = MAX_DELAY_MS
): number {
  // Exponential backoff: 2^(attempt-1) * baseDelay
  const exponentialDelay = Math.pow(2, attempt - 1) * baseDelay;

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter: random value between 0 and baseDelay * jitterFactor
  const jitter = Math.random() * baseDelay * JITTER_FACTOR;

  return cappedDelay + jitter;
}

/**
 * Classify failure as transient or permanent
 *
 * Transient failures:
 * - Network timeouts
 * - Rate limiting
 * - Service unavailable (5xx errors)
 * - Connection errors
 *
 * Permanent failures:
 * - Invalid email address
 * - Authentication errors (401, 403)
 * - Domain not found
 * - Recipient blocked
 *
 * @param errorMessage - Error message from email provider
 * @returns Failure classification
 */
export function classifyFailure(errorMessage: string): FailureClassification {
  const lowerError = errorMessage.toLowerCase();

  // Permanent failure patterns
  const permanentPatterns = [
    "invalid email",
    "email does not exist",
    "domain not found",
    "recipient rejected",
    "401",
    "403",
    "unauthorized",
    "forbidden",
    "invalid api key",
    "blocked recipient",
    "mailbox not found",
    "user unknown",
  ];

  // Transient failure patterns
  const transientPatterns = [
    "timeout",
    "rate limit",
    "service unavailable",
    "temporarily unavailable",
    "network error",
    "502",
    "503",
    "504",
    "econnrefused",
    "etimedout",
    "connection reset",
    "socket hang up",
  ];

  // Check for permanent patterns first
  for (const pattern of permanentPatterns) {
    if (lowerError.includes(pattern)) {
      return "permanent";
    }
  }

  // Check for transient patterns
  for (const pattern of transientPatterns) {
    if (lowerError.includes(pattern)) {
      return "transient";
    }
  }

  // Default to transient for unknown errors (safer to retry)
  return "transient";
}

/**
 * Email Retry Service
 *
 * Handles retry logic with exponential backoff and failure classification
 */
export class EmailRetryService {
  /**
   * Retry a failed email operation
   *
   * @param failureId - Email failure ID from database
   * @param retryOperation - Function to retry the email send
   * @returns Retry result
   */
  async retryFailure(
    failureId: string,
    retryOperation: () => Promise<{ success: boolean; error?: string }>
  ): Promise<RetryResult> {
    // Fetch failure record
    const [failure] = await db
      .select()
      .from(emailFailures)
      .where(eq(emailFailures.id, failureId))
      .limit(1);

    if (!failure) {
      return {
        success: false,
        error: `Failure ${failureId} not found`,
      };
    }

    // Classify failure
    const classification = classifyFailure(failure.errorMessage);

    // Don't retry permanent failures
    if (classification === "permanent") {
      return {
        success: false,
        permanent: true,
        error: "Permanent failure - not retrying",
      };
    }

    // Check retry limit
    const retryLimit = getRetryLimitForEmailType(failure.emailType);
    if (failure.retryCount >= retryLimit) {
      return {
        success: false,
        exhausted: true,
        error: `Retry limit exceeded (${retryLimit} attempts)`,
      };
    }

    // Calculate backoff delay
    const nextAttempt = failure.retryCount + 1;
    const delay = calculateBackoffDelay(nextAttempt);

    // Wait for backoff delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // Attempt retry
      const result = await retryOperation();

      if (result.success) {
        // Mark as resolved
        await db
          .update(emailFailures)
          .set({ resolvedAt: new Date() })
          .where(eq(emailFailures.id, failureId))
          .returning();

        return { success: true };
      } else {
        // Increment retry count
        await db
          .update(emailFailures)
          .set({ retryCount: nextAttempt })
          .where(eq(emailFailures.id, failureId))
          .returning();

        // Calculate next retry time
        const nextDelay = calculateBackoffDelay(nextAttempt + 1);
        const nextRetryAt = new Date(Date.now() + nextDelay);

        return {
          success: false,
          error: result.error || "Retry failed",
          nextRetryAt,
        };
      }
    } catch (error) {
      // Increment retry count
      await db
        .update(emailFailures)
        .set({ retryCount: nextAttempt })
        .where(eq(emailFailures.id, failureId))
        .returning();

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Calculate next retry time
      const nextDelay = calculateBackoffDelay(nextAttempt + 1);
      const nextRetryAt = new Date(Date.now() + nextDelay);

      return {
        success: false,
        error: errorMessage,
        nextRetryAt,
      };
    }
  }

  /**
   * Get failures eligible for retry
   *
   * @param emailType - Optional filter by email type
   * @returns List of failures that can be retried
   */
  async getRetryableFailures(
    emailType?: "reminder" | "disclosure" | "admin_notification" | "verification"
  ): Promise<EmailFailureContext[]> {
    const query = db.select().from(emailFailures);

    const failures = await query;

    // Filter retryable failures
    return failures
      .filter((failure) => {
        // Skip resolved failures
        if (failure.resolvedAt) return false;

        // Filter by email type if specified
        if (emailType && failure.emailType !== emailType) return false;

        // Check retry limit
        const limit = getRetryLimitForEmailType(failure.emailType);
        if (failure.retryCount >= limit) return false;

        // Check if permanent failure
        const classification = classifyFailure(failure.errorMessage);
        if (classification === "permanent") return false;

        return true;
      })
      .map((f) => ({
        id: f.id,
        emailType: f.emailType,
        provider: f.provider,
        recipient: f.recipient,
        subject: f.subject,
        errorMessage: f.errorMessage,
        retryCount: f.retryCount,
        createdAt: f.createdAt,
        resolvedAt: f.resolvedAt,
      }));
  }

  /**
   * Retry all eligible failures
   *
   * @param retryOperationFactory - Function that creates retry operation for each failure
   * @returns Summary of retry results
   */
  async retryAll(
    retryOperationFactory: (
      failure: EmailFailureContext
    ) => Promise<{ success: boolean; error?: string }>
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    permanent: number;
    exhausted: number;
  }> {
    const failures = await this.getRetryableFailures();

    let successful = 0;
    let failed = 0;
    let permanent = 0;
    let exhausted = 0;

    for (const failure of failures) {
      const retryOperation = () => retryOperationFactory(failure);
      const result = await this.retryFailure(failure.id, retryOperation);

      if (result.success) {
        successful++;
      } else if (result.permanent) {
        permanent++;
      } else if (result.exhausted) {
        exhausted++;
      } else {
        failed++;
      }
    }

    return {
      total: failures.length,
      successful,
      failed,
      permanent,
      exhausted,
    };
  }
}
