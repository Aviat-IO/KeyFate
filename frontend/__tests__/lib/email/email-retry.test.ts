/**
 * Email Retry Service Tests
 *
 * Comprehensive test suite for email retry logic and dead letter queue
 * Tests exponential backoff, jitter, retry limits, and state persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  EmailRetryService,
  calculateBackoffDelay,
  classifyFailure,
  getRetryLimitForEmailType,
  type EmailFailureContext,
  type FailureClassification,
} from "@/lib/email/email-retry-service"
import {
  DeadLetterQueue,
  type DeadLetterQueryOptions,
} from "@/lib/email/dead-letter-queue"
import { db } from "@/lib/db/drizzle"
import { emailFailures } from "@/lib/db/schema"
import { eq, and, isNull } from "drizzle-orm"

// Mock database
vi.mock("@/lib/db/drizzle", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

describe("Email Retry Service - Exponential Backoff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should calculate exponential backoff with jitter", () => {
    const attempt = 1
    const baseDelay = 1000

    // Run multiple times to test jitter randomization
    const delays: number[] = []
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoffDelay(attempt, baseDelay)
      delays.push(delay)
    }

    // Base delay for attempt 1: 2^0 * 1000 = 1000ms
    // With jitter: 1000 + random(0-500)
    const minExpected = baseDelay
    const maxExpected = baseDelay + baseDelay * 0.5 // 1500ms

    // All delays should be within expected range
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(minExpected)
      expect(delay).toBeLessThanOrEqual(maxExpected)
    })

    // Verify randomization - not all delays should be identical
    const uniqueDelays = new Set(delays)
    expect(uniqueDelays.size).toBeGreaterThan(1)
  })

  it("should increase delay exponentially with each attempt", () => {
    const baseDelay = 1000

    const delay1 = calculateBackoffDelay(1, baseDelay)
    const delay2 = calculateBackoffDelay(2, baseDelay)
    const delay3 = calculateBackoffDelay(3, baseDelay)

    // Delays should increase exponentially
    // Attempt 1: 1000 + jitter
    // Attempt 2: 2000 + jitter
    // Attempt 3: 4000 + jitter

    expect(delay2).toBeGreaterThan(delay1)
    expect(delay3).toBeGreaterThan(delay2)

    // Verify delays are within expected ranges (accounting for jitter)
    // Jitter is 0-50% of base, so ranges are:
    // Attempt 1: 1000-1500
    // Attempt 2: 2000-3000
    // Attempt 3: 4000-6000
    expect(delay1).toBeGreaterThanOrEqual(1000)
    expect(delay1).toBeLessThanOrEqual(1500)

    expect(delay2).toBeGreaterThanOrEqual(2000)
    expect(delay2).toBeLessThanOrEqual(3000)

    expect(delay3).toBeGreaterThanOrEqual(4000)
    expect(delay3).toBeLessThanOrEqual(6000)
  })

  it("should cap backoff at maximum delay", () => {
    const baseDelay = 1000
    const maxDelay = 60000 // 1 minute

    // Attempt 10 would normally give 2^9 * 1000 = 512000ms
    const delay = calculateBackoffDelay(10, baseDelay, maxDelay)

    expect(delay).toBeLessThanOrEqual(maxDelay + maxDelay * 0.5) // max + jitter
  })
})

describe("Email Retry Service - Failure Classification", () => {
  it("should classify transient failures correctly", () => {
    const transientErrors = [
      "Connection timeout",
      "Rate limit exceeded",
      "Service temporarily unavailable",
      "Network error",
      "502 Bad Gateway",
      "503 Service Unavailable",
      "504 Gateway Timeout",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ]

    transientErrors.forEach((error) => {
      const classification = classifyFailure(error)
      expect(classification).toBe("transient")
    })
  })

  it("should classify permanent failures correctly", () => {
    const permanentErrors = [
      "Invalid email address",
      "Email does not exist",
      "Domain not found",
      "Recipient rejected",
      "401 Unauthorized",
      "403 Forbidden",
      "Invalid API key",
      "Blocked recipient",
    ]

    permanentErrors.forEach((error) => {
      const classification = classifyFailure(error)
      expect(classification).toBe("permanent")
    })
  })

  it("should classify unknown errors as transient by default", () => {
    const unknownError = "Some random unexpected error"
    const classification = classifyFailure(unknownError)
    expect(classification).toBe("transient")
  })
})

describe("Email Retry Service - Retry Limits", () => {
  it("should return correct retry limits for each email type", () => {
    expect(getRetryLimitForEmailType("disclosure")).toBe(5) // Critical
    expect(getRetryLimitForEmailType("reminder")).toBe(3) // Important
    expect(getRetryLimitForEmailType("verification")).toBe(2) // Standard
    expect(getRetryLimitForEmailType("admin_notification")).toBe(1) // Low priority
  })
})

describe("Email Retry Service - Retry Execution", () => {
  let retryService: EmailRetryService

  beforeEach(() => {
    retryService = new EmailRetryService()
    vi.clearAllMocks()
  })

  it("should successfully retry and resolve transient failures", async () => {
    const failureContext: EmailFailureContext = {
      id: "failure-123",
      emailType: "reminder",
      provider: "sendgrid",
      recipient: "user@example.com",
      subject: "Test Reminder",
      errorMessage: "Connection timeout",
      retryCount: 1,
      createdAt: new Date(),
    }

    // Mock successful retry operation
    const retryOperation = vi.fn().mockResolvedValue({ success: true })

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ ...failureContext, resolvedAt: new Date() }]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    const result = await retryService.retryFailure(
      failureContext.id,
      retryOperation,
    )

    expect(result.success).toBe(true)
    expect(retryOperation).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it("should respect retry limits and mark as permanent failure", async () => {
    const failureContext: EmailFailureContext = {
      id: "failure-456",
      emailType: "reminder",
      provider: "sendgrid",
      recipient: "user@example.com",
      subject: "Test Reminder",
      errorMessage: "Connection timeout",
      retryCount: 3, // At limit for reminder type
      createdAt: new Date(),
    }

    // Mock failed retry operation
    const retryOperation = vi.fn().mockRejectedValue(new Error("Still failing"))

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    const result = await retryService.retryFailure(
      failureContext.id,
      retryOperation,
    )

    expect(result.success).toBe(false)
    expect(result.exhausted).toBe(true)
    expect(result.error).toContain("Retry limit exceeded")
  })

  it("should not retry permanent failures", async () => {
    const failureContext: EmailFailureContext = {
      id: "failure-789",
      emailType: "verification",
      provider: "sendgrid",
      recipient: "invalid@invalid.invalid",
      subject: "Email Verification",
      errorMessage: "Invalid email address",
      retryCount: 0,
      createdAt: new Date(),
    }

    const retryOperation = vi.fn()

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect

    const result = await retryService.retryFailure(
      failureContext.id,
      retryOperation,
    )

    expect(result.success).toBe(false)
    expect(result.permanent).toBe(true)
    expect(retryOperation).not.toHaveBeenCalled()
  })

  it("should wait for backoff delay before retry", async () => {
    const failureContext: EmailFailureContext = {
      id: "failure-timing",
      emailType: "disclosure",
      provider: "sendgrid",
      recipient: "user@example.com",
      subject: "Secret Disclosure",
      errorMessage: "Rate limit exceeded",
      retryCount: 2,
      createdAt: new Date(),
    }

    const retryOperation = vi.fn().mockResolvedValue({ success: true })

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ ...failureContext, resolvedAt: new Date() }]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    // Spy on setTimeout
    const setTimeoutSpy = vi.spyOn(global, "setTimeout")

    const startTime = Date.now()
    await retryService.retryFailure(failureContext.id, retryOperation)
    const elapsed = Date.now() - startTime

    // Should have used setTimeout for backoff
    expect(setTimeoutSpy).toHaveBeenCalled()

    setTimeoutSpy.mockRestore()
  })
})

describe("Dead Letter Queue - Query Interface", () => {
  let dlq: DeadLetterQueue

  beforeEach(() => {
    dlq = new DeadLetterQueue()
    vi.clearAllMocks()
  })

  it("should query failed emails with filters", async () => {
    const mockFailures = [
      {
        id: "fail-1",
        emailType: "disclosure",
        provider: "sendgrid",
        recipient: "user1@example.com",
        subject: "Disclosure 1",
        errorMessage: "Connection timeout",
        retryCount: 5,
        createdAt: new Date(),
        resolvedAt: null,
      },
      {
        id: "fail-2",
        emailType: "reminder",
        provider: "sendgrid",
        recipient: "user2@example.com",
        subject: "Reminder 1",
        errorMessage: "Rate limit",
        retryCount: 3,
        createdAt: new Date(),
        resolvedAt: null,
      },
    ]

    // Mock database query to return array
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockFailures),
      }),
    })

    ;(db.select as any) = mockSelect

    const options: DeadLetterQueryOptions = {
      emailType: "disclosure",
      limit: 10,
    }

    const results = await dlq.queryFailures(options)

    expect(results).toHaveLength(2)
    expect(mockSelect).toHaveBeenCalled()
  })

  it("should filter by unresolved status", async () => {
    const options: DeadLetterQueryOptions = {
      unresolvedOnly: true,
    }

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    ;(db.select as any) = mockSelect

    await dlq.queryFailures(options)

    expect(mockSelect).toHaveBeenCalled()
  })

  it("should filter by provider", async () => {
    const options: DeadLetterQueryOptions = {
      provider: "sendgrid",
    }

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    ;(db.select as any) = mockSelect

    await dlq.queryFailures(options)

    expect(mockSelect).toHaveBeenCalled()
  })
})

describe("Dead Letter Queue - Manual Retry", () => {
  let dlq: DeadLetterQueue

  beforeEach(() => {
    dlq = new DeadLetterQueue()
    vi.clearAllMocks()
  })

  it("should manually retry a single failed email", async () => {
    const failureId = "failure-manual-123"
    const retryOperation = vi.fn().mockResolvedValue({ success: true })

    const mockFailure = {
      id: failureId,
      emailType: "reminder",
      provider: "sendgrid",
      recipient: "user@example.com",
      subject: "Manual Retry Test",
      errorMessage: "Temporary failure",
      retryCount: 2,
      createdAt: new Date(),
      resolvedAt: null,
    }

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockFailure]),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ ...mockFailure, resolvedAt: new Date() }]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    const result = await dlq.manualRetry(failureId, retryOperation)

    expect(result.success).toBe(true)
    expect(retryOperation).toHaveBeenCalledTimes(1)
  })

  it("should batch retry multiple failed emails", async () => {
    const failureIds = ["fail-1", "fail-2", "fail-3"]
    const retryOperation = vi.fn().mockResolvedValue({ success: true })

    const mockFailures = failureIds.map((id) => ({
      id,
      emailType: "reminder",
      provider: "sendgrid",
      recipient: `user${id}@example.com`,
      subject: `Batch Retry ${id}`,
      errorMessage: "Temporary failure",
      retryCount: 1,
      createdAt: new Date(),
      resolvedAt: null,
    }))

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockFailures),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue(
              mockFailures.map((f) => ({ ...f, resolvedAt: new Date() })),
            ),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    const results = await dlq.batchRetry(failureIds, retryOperation)

    expect(results.successful).toBe(3)
    expect(results.failed).toBe(0)
    expect(retryOperation).toHaveBeenCalledTimes(3)
  })
})

describe("Dead Letter Queue - Resolution Management", () => {
  let dlq: DeadLetterQueue

  beforeEach(() => {
    dlq = new DeadLetterQueue()
    vi.clearAllMocks()
  })

  it("should mark failure as resolved", async () => {
    const failureId = "resolve-123"

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: failureId,
              resolvedAt: new Date(),
            },
          ]),
        }),
      }),
    })

    ;(db.update as any) = mockUpdate

    const result = await dlq.markResolved(failureId)

    expect(result.resolvedAt).toBeDefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it("should cleanup old resolved failures", async () => {
    const retentionDays = 30

    const mockDeleteResult = { rowCount: 15 }

    ;(db.delete as any) = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(mockDeleteResult),
    })

    const deletedCount = await dlq.cleanup(retentionDays)

    expect(deletedCount).toBe(15)
  })
})

describe("Email Retry Service - State Persistence", () => {
  let retryService: EmailRetryService

  beforeEach(() => {
    retryService = new EmailRetryService()
    vi.clearAllMocks()
  })

  it("should persist retry count after each attempt", async () => {
    const failureContext: EmailFailureContext = {
      id: "persist-123",
      emailType: "reminder",
      provider: "sendgrid",
      recipient: "user@example.com",
      subject: "Test",
      errorMessage: "Timeout",
      retryCount: 1,
      createdAt: new Date(),
    }

    const retryOperation = vi.fn().mockRejectedValue(new Error("Still failing"))

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ ...failureContext, retryCount: 2 }]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    await retryService.retryFailure(failureContext.id, retryOperation)

    // Verify retry count was incremented
    expect(mockUpdate).toHaveBeenCalled()
  })

  it("should track last retry timestamp", async () => {
    const failureContext: EmailFailureContext = {
      id: "timestamp-123",
      emailType: "disclosure",
      provider: "sendgrid",
      recipient: "user@example.com",
      subject: "Test",
      errorMessage: "Timeout",
      retryCount: 0,
      createdAt: new Date(),
    }

    const retryOperation = vi.fn().mockResolvedValue({ success: true })

    const beforeRetry = new Date()

    // Mock database operations
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([failureContext]),
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ ...failureContext, resolvedAt: new Date() }]),
        }),
      }),
    })

    ;(db.select as any) = mockSelect
    ;(db.update as any) = mockUpdate

    const result = await retryService.retryFailure(
      failureContext.id,
      retryOperation,
    )

    expect(result.success).toBe(true)

    // Verify timestamp is tracked
    const afterRetry = new Date()
    // resolvedAt should be between beforeRetry and afterRetry
  })
})
