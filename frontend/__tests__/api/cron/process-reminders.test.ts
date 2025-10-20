import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/cron/process-reminders/route"
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

const mockSendSecretDisclosureEmail = vi.fn()
const mockLogEmailFailure = vi.fn()
const mockSendAdminNotification = vi.fn()
const mockGetAllRecipients = vi.fn()
const mockDecryptMessage = vi.fn()

vi.mock("@/lib/email/email-service", () => ({
  sendSecretDisclosureEmail: (args: unknown) =>
    mockSendSecretDisclosureEmail(args),
}))

vi.mock("@/lib/email/email-failure-logger", () => ({
  logEmailFailure: (args: unknown) => mockLogEmailFailure(args),
}))

vi.mock("@/lib/email/admin-notification-service", () => ({
  sendAdminNotification: (args: unknown) => mockSendAdminNotification(args),
}))

vi.mock("@/lib/db/queries/secrets", () => ({
  getAllRecipients: (secretId: string) => mockGetAllRecipients(secretId),
}))

vi.mock("@/lib/encryption", () => ({
  decryptMessage: (serverShare: string, iv: Buffer, authTag: Buffer) =>
    mockDecryptMessage(serverShare, iv, authTag),
}))

vi.mock("@/lib/email/email-retry-service", () => ({
  calculateBackoffDelay: (attempt: number, baseDelay: number) =>
    baseDelay * Math.pow(2, attempt - 1),
}))

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>()
  return {
    ...actual,
    default: {
      ...actual,
      timingSafeEqual: vi.fn(() => true),
    },
    timingSafeEqual: vi.fn(() => true),
  }
})

describe("POST /api/cron/process-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-secret"

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    })

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      onConflictDoNothing: vi.fn().mockReturnThis(),
    })
  })

  it("should reject unauthorized requests", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/cron/process-reminders",
      {
        method: "POST",
        headers: {
          authorization: "Bearer wrong-secret",
        },
      },
    )

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
  })

  it("should process overdue secrets successfully", async () => {
    const mockSecret = {
      id: "secret-1",
      userId: "user-1",
      title: "Test Secret",
      serverShare: "encrypted-content",
      iv: Buffer.from("test-iv").toString("base64"),
      authTag: Buffer.from("test-auth-tag").toString("base64"),
      retryCount: 0,
      lastCheckIn: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
    }

    const mockUser = {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
    }

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValue([{ secret: mockSecret, user: mockUser }]),
    })

    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: mockSecret.id }]),
    })

    mockGetAllRecipients.mockResolvedValue([
      { id: "recipient-1", email: "recipient@example.com", name: "Recipient" },
    ])

    mockDecryptMessage.mockResolvedValue("Decrypted secret content")

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    })

    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "log-1" }]),
      onConflictDoNothing: vi.fn().mockReturnThis(),
    })

    mockSendSecretDisclosureEmail.mockResolvedValue({ success: true })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/process-reminders",
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
    expect(data.processed).toBeGreaterThan(0)
  })

  it("should handle secrets exceeding retry limit", async () => {
    const mockSecret = {
      id: "secret-1",
      userId: "user-1",
      title: "Test Secret",
      retryCount: 5,
      serverShare: "encrypted-content",
      iv: Buffer.from("test-iv").toString("base64"),
      authTag: Buffer.from("test-auth-tag").toString("base64"),
    }

    const mockUser = {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
    }

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValue([{ secret: mockSecret, user: mockUser }]),
    })

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: mockSecret.id }]),
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/process-reminders",
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
    expect(mockDb.update).toHaveBeenCalled()
  })

  it("should skip duplicate emails using unique constraint", async () => {
    const mockSecret = {
      id: "secret-1",
      userId: "user-1",
      title: "Test Secret",
      serverShare: "encrypted-content",
      iv: Buffer.from("test-iv").toString("base64"),
      authTag: Buffer.from("test-auth-tag").toString("base64"),
      retryCount: 0,
    }

    const mockUser = {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
    }

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValue([{ secret: mockSecret, user: mockUser }]),
    })

    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: mockSecret.id }]),
    })

    mockGetAllRecipients.mockResolvedValue([
      { id: "recipient-1", email: "recipient@example.com", name: "Recipient" },
    ])

    mockDecryptMessage.mockResolvedValue("Decrypted secret content")

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: "existing-log",
          secretId: mockSecret.id,
          recipientEmail: "recipient@example.com",
          status: "sent",
        },
      ]),
    })

    const req = new NextRequest(
      "http://localhost:3000/api/cron/process-reminders",
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
    expect(mockSendSecretDisclosureEmail).not.toHaveBeenCalled()
  })
})
