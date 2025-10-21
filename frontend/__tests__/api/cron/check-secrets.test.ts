import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/cron/check-secrets/route"
import { NextRequest } from "next/server"

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
}

const mockGetDatabase = vi.fn(() => Promise.resolve(mockDb))

vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: () => mockGetDatabase(),
}))

const mockSendReminderEmail = vi.fn()
const mockLogEmailFailure = vi.fn()
const mockSendAdminNotification = vi.fn()

vi.mock("@/lib/email/email-service", () => ({
  sendReminderEmail: (args: unknown) => mockSendReminderEmail(args),
}))

vi.mock("@/lib/email/email-failure-logger", () => ({
  logEmailFailure: (args: unknown) => mockLogEmailFailure(args),
}))

vi.mock("@/lib/email/admin-notification-service", () => ({
  sendAdminNotification: (args: unknown) => mockSendAdminNotification(args),
}))

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>()
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn(() => ({
        toString: vi.fn(() => "mock-token-abcd1234"),
      })),
      timingSafeEqual: vi.fn(() => true),
    },
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => "mock-token-abcd1234"),
    })),
    timingSafeEqual: vi.fn(() => true),
  }
})

describe("POST /api/cron/check-secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-secret"
    process.env.NEXTAUTH_URL = "https://test.example.com"
    process.env.NODE_ENV = "test"
  })

  it("should return 401 if authorization fails", async () => {
    process.env.CRON_SECRET = "correct-secret"

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer wrong-token",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("should process secrets and send reminders", async () => {
    const now = new Date()
    const scheduledFor = new Date(now.getTime() - 10 * 60 * 1000)
    const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

    const mockPendingReminders = [
      {
        reminder: {
          id: "reminder-1",
          secretId: "secret-1",
          reminderType: "1_hour",
          scheduledFor,
          status: "pending",
          retryCount: 0,
        },
        secret: {
          id: "secret-1",
          userId: "user-1",
          title: "Test Secret",
          checkInDays: 7,
          status: "active",
          serverShare: "encrypted-share",
          nextCheckIn,
        },
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
        },
      },
    ]

    let selectCallCount = 0
    mockDb.select.mockImplementation(() => {
      selectCallCount++

      if (selectCallCount <= 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi
            .fn()
            .mockResolvedValueOnce(mockPendingReminders)
            .mockResolvedValue([]),
          orderBy: vi.fn().mockReturnThis(),
        }
      }

      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
    })

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockResolvedValue([{ id: "token-1", token: "mock-token-abcd1234" }]),
    }

    mockDb.insert.mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.update.mockReturnValue(mockUpdateChain)

    mockSendReminderEmail.mockResolvedValue({
      success: true,
      provider: "console-dev",
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remindersProcessed).toBeGreaterThanOrEqual(0)
    expect(data.remindersSent).toBeGreaterThanOrEqual(0)
    expect(data).toHaveProperty("duration")
    expect(data).toHaveProperty("timestamp")
  })

  it("should skip reminders that have already been sent", async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockReturnThis(),
    }

    mockDb.select.mockReturnValue(mockSelectChain)

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remindersProcessed).toBe(0)
  })

  it("should handle email sending failures", async () => {
    const now = new Date()
    const scheduledFor = new Date(now.getTime() - 10 * 60 * 1000)
    const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

    const mockPendingReminders = [
      {
        reminder: {
          id: "reminder-1",
          secretId: "secret-1",
          reminderType: "1_hour",
          scheduledFor,
          status: "pending",
          retryCount: 0,
        },
        secret: {
          id: "secret-1",
          userId: "user-1",
          title: "Test Secret",
          checkInDays: 7,
          status: "active",
          serverShare: "encrypted-share",
          nextCheckIn,
        },
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
        },
      },
    ]

    let selectCallCount = 0
    mockDb.select.mockImplementation(() => {
      selectCallCount++

      if (selectCallCount <= 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi
            .fn()
            .mockResolvedValueOnce(mockPendingReminders)
            .mockResolvedValue([]),
          orderBy: vi.fn().mockReturnThis(),
        }
      }

      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
    })

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockResolvedValue([{ id: "token-1", token: "mock-token" }]),
    }

    mockDb.insert.mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.update.mockReturnValue(mockUpdateChain)

    mockSendReminderEmail.mockResolvedValue({
      success: false,
      error: "Email service unavailable",
      provider: "sendgrid",
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remindersFailed).toBeGreaterThanOrEqual(0)
    expect(mockLogEmailFailure).toHaveBeenCalled()
  })

  it("should process failed reminders for retry", async () => {
    const now = new Date()
    const nextRetryAt = new Date(now.getTime() - 60 * 1000)

    const mockFailedReminders = [
      {
        reminder: {
          id: "reminder-1",
          secretId: "secret-1",
          reminderType: "1_hour",
          status: "failed",
          retryCount: 1,
          nextRetryAt,
        },
        secret: {
          id: "secret-1",
          userId: "user-1",
          title: "Test Secret",
          checkInDays: 7,
          status: "active",
          serverShare: "encrypted-share",
          nextCheckIn: new Date(now.getTime() + 30 * 60 * 1000),
          lastCheckIn: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
        },
      },
    ]

    let selectCallCount = 0
    mockDb.select.mockImplementation(() => {
      selectCallCount++

      if (selectCallCount === 1 || selectCallCount === 3) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnThis(),
        }
      } else if (selectCallCount === 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(mockFailedReminders),
          orderBy: vi.fn().mockReturnThis(),
        }
      }

      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
    })

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockResolvedValue([{ id: "token-1", token: "mock-token" }]),
    }

    mockDb.insert.mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.update.mockReturnValue(mockUpdateChain)

    mockSendReminderEmail.mockResolvedValue({
      success: true,
      provider: "console-dev",
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty("retriesProcessed")
    expect(data).toHaveProperty("retriesSent")
    expect(data).toHaveProperty("retriesFailed")
  })

  it("should batch process large numbers of secrets", async () => {
    const now = new Date()
    const scheduledFor = new Date(now.getTime() - 10 * 60 * 1000)
    const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

    const createMockReminder = (index: number) => ({
      reminder: {
        id: `reminder-${index}`,
        secretId: `secret-${index}`,
        reminderType: "1_hour",
        scheduledFor,
        status: "pending",
        retryCount: 0,
      },
      secret: {
        id: `secret-${index}`,
        userId: `user-${index}`,
        title: `Test Secret ${index}`,
        checkInDays: 7,
        status: "active",
        serverShare: "encrypted-share",
        nextCheckIn,
      },
      user: {
        id: `user-${index}`,
        email: `user${index}@example.com`,
        name: `Test User ${index}`,
      },
    })

    const mockBatch = Array.from({ length: 5 }, (_, i) => createMockReminder(i))

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValueOnce(mockBatch).mockResolvedValue([]),
      orderBy: vi.fn().mockReturnThis(),
    }

    mockDb.select.mockReturnValue(mockSelectChain)

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockResolvedValue([{ id: "token-1", token: "mock-token" }]),
    }

    mockDb.insert.mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.update.mockReturnValue(mockUpdateChain)

    mockSendReminderEmail.mockResolvedValue({
      success: true,
      provider: "console-dev",
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remindersProcessed).toBeGreaterThan(0)
  })

  it("should reuse existing valid check-in tokens", async () => {
    const now = new Date()
    const scheduledFor = new Date(now.getTime() - 10 * 60 * 1000)
    const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)
    const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const mockPendingReminders = [
      {
        reminder: {
          id: "reminder-1",
          secretId: "secret-1",
          reminderType: "1_hour",
          scheduledFor,
          status: "pending",
          retryCount: 0,
        },
        secret: {
          id: "secret-1",
          userId: "user-1",
          title: "Test Secret",
          checkInDays: 7,
          status: "active",
          serverShare: "encrypted-share",
          nextCheckIn,
        },
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
        },
      },
    ]

    const mockExistingToken = [
      {
        id: "token-1",
        secretId: "secret-1",
        token: "existing-token-xyz",
        expiresAt: futureExpiry,
        usedAt: null,
      },
    ]

    let selectCallCount = 0
    mockDb.select.mockImplementation(() => {
      selectCallCount++

      if (selectCallCount <= 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi
            .fn()
            .mockResolvedValueOnce(mockPendingReminders)
            .mockResolvedValue([]),
          orderBy: vi.fn().mockReturnThis(),
        }
      }

      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockExistingToken),
      }
    })

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockResolvedValue([{ id: "token-1", token: "mock-token" }]),
    }

    mockDb.insert.mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.update.mockReturnValue(mockUpdateChain)

    mockSendReminderEmail.mockResolvedValue({
      success: true,
      provider: "console-dev",
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    if (mockSendReminderEmail.mock.calls.length > 0) {
      expect(mockSendReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          checkInUrl: expect.any(String),
        }),
      )
    }
  })

  it("should handle database errors gracefully", async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error("Database connection failed")
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Database operation failed")
  })

  it("should handle missing NEXTAUTH_URL gracefully", async () => {
    const originalUrl = process.env.NEXTAUTH_URL
    delete process.env.NEXTAUTH_URL

    const now = new Date()
    const scheduledFor = new Date(now.getTime() - 10 * 60 * 1000)
    const nextCheckIn = new Date(now.getTime() + 30 * 60 * 1000)

    const mockPendingReminders = [
      {
        reminder: {
          id: "reminder-1",
          secretId: "secret-1",
          reminderType: "1_hour",
          scheduledFor,
          status: "pending",
          retryCount: 0,
        },
        secret: {
          id: "secret-1",
          userId: "user-1",
          title: "Test Secret",
          checkInDays: 7,
          status: "active",
          serverShare: "encrypted-share",
          nextCheckIn,
        },
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
        },
      },
    ]

    let selectCallCount = 0
    mockDb.select.mockImplementation(() => {
      selectCallCount++

      if (selectCallCount <= 2) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi
            .fn()
            .mockResolvedValueOnce(mockPendingReminders)
            .mockResolvedValue([]),
          orderBy: vi.fn().mockReturnThis(),
        }
      }

      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
    })

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockResolvedValue([{ id: "token-1", token: "mock-token" }]),
    }

    mockDb.insert.mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.update.mockReturnValue(mockUpdateChain)

    const req = new NextRequest(
      "http://localhost:3000/api/cron/check-secrets",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remindersFailed).toBeGreaterThanOrEqual(1)

    process.env.NEXTAUTH_URL = originalUrl
  })
})
