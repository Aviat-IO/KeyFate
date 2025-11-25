/**
 * Retry Utility with Exponential Backoff
 *
 * Provides configurable retry logic for external API calls with
 * exponential backoff, jitter, and timeout support.
 */

import { logger } from "@/lib/logger"

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxAttempts?: number

  /**
   * Initial delay in milliseconds (default: 1000ms)
   */
  initialDelay?: number

  /**
   * Maximum delay between retries in milliseconds (default: 30000ms / 30s)
   */
  maxDelay?: number

  /**
   * Backoff multiplier (default: 2 for exponential backoff)
   */
  backoffMultiplier?: number

  /**
   * Add random jitter to prevent thundering herd (default: true)
   */
  enableJitter?: boolean

  /**
   * Timeout for each attempt in milliseconds (optional)
   */
  timeout?: number

  /**
   * Function to determine if error is retryable (default: all errors retryable)
   */
  isRetryable?: (error: Error) => boolean

  /**
   * Callback invoked before each retry
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDuration: number
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, "timeout" | "onRetry">> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  enableJitter: true,
  isRetryable: () => true,
}

/**
 * Calculate delay for next retry with exponential backoff
 */
function calculateDelay(
  attempt: number,
  config: Required<Omit<RetryConfig, "timeout" | "onRetry">>,
): number {
  const exponentialDelay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1)

  const cappedDelay = Math.min(exponentialDelay, config.maxDelay)

  if (config.enableJitter) {
    // Add ±25% jitter
    const jitterRange = cappedDelay * 0.25
    const jitter = Math.random() * jitterRange * 2 - jitterRange
    return Math.max(0, cappedDelay + jitter)
  }

  return cappedDelay
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute function with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Operation timed out")), timeoutMs),
  )

  return Promise.race([promise, timeoutPromise])
}

/**
 * Retry function execution with exponential backoff
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Promise resolving to result or throwing last error
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data')
 *     return response.json()
 *   },
 *   {
 *     maxAttempts: 5,
 *     initialDelay: 500,
 *     isRetryable: (error) => {
 *       // Only retry on network errors, not 4xx client errors
 *       return !error.message.includes('400')
 *     }
 *   }
 * )
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  userConfig: RetryConfig = {},
): Promise<T> {
  const config = { ...DEFAULT_CONFIG, ...userConfig }
  const startTime = Date.now()

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const attemptPromise = fn()

      const result = config.timeout
        ? await withTimeout(attemptPromise, config.timeout)
        : await attemptPromise

      const duration = Date.now() - startTime

      if (attempt > 1) {
        logger.info("Retry succeeded", {
          attempt,
          duration,
        })
      }

      return result
    } catch (error) {
      lastError = error as Error

      // Check if we should retry this error
      const shouldRetry = config.isRetryable(lastError)

      if (!shouldRetry || attempt === config.maxAttempts) {
        const duration = Date.now() - startTime
        logger.warn("Retry exhausted or non-retryable error", {
          attempt,
          maxAttempts: config.maxAttempts,
          duration,
          error: lastError.message,
          retryable: shouldRetry,
        })
        throw lastError
      }

      // Calculate delay and wait before next attempt
      const delay = calculateDelay(attempt, config)

      logger.info("Retrying after error", {
        attempt,
        maxAttempts: config.maxAttempts,
        delay,
        error: lastError.message,
      })

      // Invoke retry callback if provided
      if (userConfig.onRetry) {
        userConfig.onRetry(lastError, attempt, delay)
      }

      await sleep(delay)
    }
  }

  // Should never reach here, but TypeScript requires this
  throw lastError || new Error("Retry failed with unknown error")
}

/**
 * Execute function with retry and return detailed result
 *
 * Unlike retry(), this function doesn't throw on failure but returns
 * a result object with success status.
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<RetryResult<T>> {
  const startTime = Date.now()
  let attempts = 0

  try {
    const data = await retry(fn, {
      ...config,
      onRetry: (error, attempt, delay) => {
        attempts = attempt
        config.onRetry?.(error, attempt, delay)
      },
    })

    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalDuration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      error: error as Error,
      attempts: config.maxAttempts ?? DEFAULT_CONFIG.maxAttempts,
      totalDuration: Date.now() - startTime,
    }
  }
}

/**
 * Common retry policies for external services
 */
export const retryPolicies = {
  /**
   * Aggressive retry for critical operations (5 attempts, 500ms initial delay)
   */
  critical: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 10000,
    enableJitter: true,
  } as RetryConfig,

  /**
   * Standard retry for normal operations (3 attempts, 1s initial delay)
   */
  standard: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    enableJitter: true,
  } as RetryConfig,

  /**
   * Conservative retry for non-critical operations (2 attempts, 2s initial delay)
   */
  conservative: {
    maxAttempts: 2,
    initialDelay: 2000,
    maxDelay: 60000,
    enableJitter: true,
  } as RetryConfig,

  /**
   * Network-specific retry (handles transient network errors)
   */
  network: {
    maxAttempts: 4,
    initialDelay: 1000,
    maxDelay: 20000,
    enableJitter: true,
    isRetryable: (error: Error) => {
      const message = error.message.toLowerCase()
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("econnreset") ||
        message.includes("enotfound") ||
        message.includes("econnrefused")
      )
    },
  } as RetryConfig,

  /**
   * HTTP-specific retry (handles 5xx errors, rate limits)
   */
  http: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    enableJitter: true,
    isRetryable: (error: Error) => {
      const message = error.message.toLowerCase()
      // Retry on 5xx, rate limit (429), service unavailable (503)
      return (
        message.includes("500") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504") ||
        message.includes("429") ||
        message.includes("rate limit")
      )
    },
  } as RetryConfig,
}

/**
 * Batch retry multiple operations with circuit breaker pattern
 *
 * Useful for batch operations where individual failures shouldn't
 * stop the entire batch.
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  config: RetryConfig = {},
): Promise<Array<RetryResult<T>>> {
  const results = await Promise.all(
    operations.map((op) => retryWithResult(op, config)),
  )

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.filter((r) => !r.success).length

  logger.info("Batch retry completed", {
    total: operations.length,
    success: successCount,
    failed: failureCount,
  })

  return results
}
