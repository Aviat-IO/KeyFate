/**
 * Tests for POST /api/secrets/[id]/send-now
 *
 * Verifies the manual send-now endpoint that retries disclosure delivery
 * for secrets in "failed" status. Covers CSRF, auth, ownership, status
 * validation, concurrency locking, decryption, email dispatch, and
 * partial-failure handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mocks (must be declared before any import of the module under test) ---

// Mock @sveltejs/kit
vi.mock("@sveltejs/kit", () => ({
  json: (data: unknown, init?: { status?: number }) =>
    new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
}))

// Mock CSRF protection
const mockRequireCSRFProtection = vi.fn()
const mockCreateCSRFErrorResponse = vi.fn()
vi.mock("$lib/csrf", () => ({
  requireCSRFProtection: (...args: unknown[]) =>
    mockRequireCSRFProtection(...args),
  createCSRFErrorResponse: (...args: unknown[]) =>
    mockCreateCSRFErrorResponse(...args),
}))

// Mock database — chainable query builder
const mockReturning = vi.fn()
const mockOnConflictDoNothing = vi.fn()
const mockWhere = vi.fn()
const mockSet = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
}

vi.mock("$lib/db/drizzle", () => ({
  getDatabase: vi.fn(async () => mockDb),
}))

// Mock schema table references
vi.mock("$lib/db/schema", () => ({
  secrets: {
    id: "secrets.id",
    userId: "secrets.userId",
    status: "secrets.status",
  },
  users: { id: "users.id" },
  disclosureLog: {
    id: "disclosureLog.id",
    secretId: "disclosureLog.secretId",
    recipientEmail: "disclosureLog.recipientEmail",
    recipientName: "disclosureLog.recipientName",
  },
}))

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}))

// Mock queries
const mockGetAllRecipients = vi.fn()
const mockHasBeenDisclosed = vi.fn()
vi.mock("$lib/db/queries/secrets", () => ({
  getAllRecipients: (...args: unknown[]) => mockGetAllRecipients(...args),
  hasBeenDisclosed: (...args: unknown[]) => mockHasBeenDisclosed(...args),
}))

// Mock email service
const mockSendSecretDisclosureEmail = vi.fn()
vi.mock("$lib/email/email-service", () => ({
  sendSecretDisclosureEmail: (...args: unknown[]) =>
    mockSendSecretDisclosureEmail(...args),
}))

// Mock email failure logger
const mockLogEmailFailure = vi.fn()
vi.mock("$lib/email/email-failure-logger", () => ({
  logEmailFailure: (...args: unknown[]) => mockLogEmailFailure(...args),
}))

// Mock encryption
const mockDecryptMessage = vi.fn()
vi.mock("$lib/encryption", () => ({
  decryptMessage: (...args: unknown[]) => mockDecryptMessage(...args),
}))

// Mock disclosure helpers
const mockUpdateDisclosureLog = vi.fn()
vi.mock("$lib/cron/disclosure-helpers", () => ({
  updateDisclosureLog: (...args: unknown[]) =>
    mockUpdateDisclosureLog(...args),
}))

// Mock logger
vi.mock("$lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// --- Constants ---

const TEST_USER_ID = "user-123"
const TEST_SECRET_ID = "550e8400-e29b-41d4-a716-446655440000"

const BASE_SECRET = {
  id: TEST_SECRET_ID,
  userId: TEST_USER_ID,
  status: "failed",
  title: "My Secret",
  serverShare: "encrypted-data",
  iv: Buffer.from("test-iv").toString("base64"),
  authTag: Buffer.from("test-auth-tag").toString("base64"),
  keyVersion: 1,
  lastCheckIn: new Date("2025-01-01"),
  createdAt: new Date("2024-12-01"),
}

const BASE_USER = {
  id: TEST_USER_ID,
  name: "Test User",
  email: "test@example.com",
}

const BASE_RECIPIENT = {
  id: "recipient-1",
  secretId: TEST_SECRET_ID,
  name: "Alice",
  email: "alice@example.com",
}

// --- Helpers ---

function createEvent(secretId = TEST_SECRET_ID) {
  return {
    params: { id: secretId },
    locals: {
      auth: vi.fn().mockResolvedValue({
        user: { id: TEST_USER_ID },
      }),
    },
    request: new Request(
      `http://localhost/api/secrets/${secretId}/send-now`,
      { method: "POST" },
    ),
  } as any
}

/**
 * Sets up the chainable db mock for sequential select/update/insert calls.
 *
 * callSequence is an array of { type, result } objects describing each
 * db operation in order. Supported types:
 *   - "select": db.select().from().where() → result
 *   - "update": db.update().set().where().returning() → result
 *   - "update-no-return": db.update().set().where() → void
 *   - "insert": db.insert().values().returning().onConflictDoNothing() → result
 */
function setupDbSequence(
  callSequence: Array<{
    type: "select" | "update" | "update-no-return" | "insert"
    result?: unknown
  }>,
) {
  let selectIdx = 0
  let updateIdx = 0
  let insertIdx = 0

  const selectCalls = callSequence.filter((c) => c.type === "select")
  const updateCalls = callSequence.filter(
    (c) => c.type === "update" || c.type === "update-no-return",
  )
  const insertCalls = callSequence.filter((c) => c.type === "insert")

  mockSelect.mockImplementation(() => ({
    from: () => ({
      where: () => selectCalls[selectIdx++]?.result ?? [],
    }),
  }))

  mockUpdate.mockImplementation(() => ({
    set: () => ({
      where: (..._args: unknown[]) => {
        const call = updateCalls[updateIdx++]
        if (call?.type === "update-no-return") {
          return { returning: () => call.result ?? [] }
        }
        return {
          returning: () => call?.result ?? [],
        }
      },
    }),
  }))

  mockInsert.mockImplementation(() => ({
    values: () => ({
      returning: () => ({
        onConflictDoNothing: () => insertCalls[insertIdx++]?.result ?? [],
      }),
    }),
  }))
}

// --- Tests ---

describe("POST /api/secrets/[id]/send-now", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Defaults: CSRF passes
    mockRequireCSRFProtection.mockResolvedValue({ valid: true })
    mockCreateCSRFErrorResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "CSRF validation failed" }), {
        status: 403,
      }),
    )

    // Defaults: no prior disclosures
    mockHasBeenDisclosed.mockResolvedValue(false)

    // Defaults: decryption succeeds
    mockDecryptMessage.mockResolvedValue("decrypted-secret-content")

    // Defaults: email succeeds
    mockSendSecretDisclosureEmail.mockResolvedValue({
      success: true,
      messageId: "msg-123",
    })

    // Defaults: disclosure log update succeeds
    mockUpdateDisclosureLog.mockResolvedValue(true)

    // Defaults: email failure logger succeeds
    mockLogEmailFailure.mockResolvedValue(undefined)
  })

  // ---------------------------------------------------------------
  // 1. CSRF validation
  // ---------------------------------------------------------------
  describe("CSRF validation", () => {
    it("returns 403 if CSRF validation fails", async () => {
      mockRequireCSRFProtection.mockResolvedValue({ valid: false })

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("CSRF validation failed")
      expect(mockCreateCSRFErrorResponse).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------
  // 2. Authentication
  // ---------------------------------------------------------------
  describe("Authentication", () => {
    it("returns 401 if no session", async () => {
      const event = createEvent()
      event.locals.auth.mockResolvedValue(null)

      const { POST } = await import("../+server")
      const response = await POST(event)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Unauthorized")
    })

    it("returns 401 if session has no user id", async () => {
      const event = createEvent()
      event.locals.auth.mockResolvedValue({ user: {} })

      const { POST } = await import("../+server")
      const response = await POST(event)

      expect(response.status).toBe(401)
    })
  })

  // ---------------------------------------------------------------
  // 3. Secret not found
  // ---------------------------------------------------------------
  describe("Secret lookup", () => {
    it("returns 404 if secret not found", async () => {
      setupDbSequence([{ type: "select", result: [] }])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe("Secret not found")
    })
  })

  // ---------------------------------------------------------------
  // 4. Status validation
  // ---------------------------------------------------------------
  describe("Status validation", () => {
    it("returns 400 if secret status is not 'failed'", async () => {
      setupDbSequence([
        { type: "select", result: [{ ...BASE_SECRET, status: "active" }] },
      ])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Only failed secrets can be sent immediately")
    })

    it("returns 400 for triggered status", async () => {
      setupDbSequence([
        { type: "select", result: [{ ...BASE_SECRET, status: "triggered" }] },
      ])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(400)
    })
  })

  // ---------------------------------------------------------------
  // 5. Already disclosed
  // ---------------------------------------------------------------
  describe("Disclosure check", () => {
    it("returns 400 if secret has already been disclosed", async () => {
      setupDbSequence([{ type: "select", result: [BASE_SECRET] }])
      mockHasBeenDisclosed.mockResolvedValue(true)

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe(
        "This secret has already been disclosed to recipients",
      )
      expect(mockHasBeenDisclosed).toHaveBeenCalledWith(TEST_SECRET_ID)
    })
  })

  // ---------------------------------------------------------------
  // 6. User not found
  // ---------------------------------------------------------------
  describe("User lookup", () => {
    it("returns 404 if user record not found", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] }, // secret found
        { type: "select", result: [] }, // user not found
      ])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe("User not found")
    })
  })

  // ---------------------------------------------------------------
  // 7. Concurrent status change (optimistic lock fails)
  // ---------------------------------------------------------------
  describe("Concurrency lock", () => {
    it("returns 409 if concurrent status change (lock fails)", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] }, // secret found
        { type: "select", result: [BASE_USER] }, // user found
        { type: "update", result: [] }, // lock returns empty (concurrent change)
      ])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe("Secret status changed concurrently")
    })
  })

  // ---------------------------------------------------------------
  // 8. No recipients
  // ---------------------------------------------------------------
  describe("Recipients check", () => {
    it("returns 400 if no recipients configured", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] }, // secret found
        { type: "select", result: [BASE_USER] }, // user found
        { type: "update", result: [{ id: TEST_SECRET_ID }] }, // lock succeeds
        { type: "update-no-return", result: undefined }, // revert to failed
      ])
      mockGetAllRecipients.mockResolvedValue([])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("No recipients configured")
    })
  })

  // ---------------------------------------------------------------
  // 9. Decryption failure
  // ---------------------------------------------------------------
  describe("Decryption", () => {
    it("returns 500 if decryption fails", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "update-no-return", result: undefined }, // revert to failed
      ])
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT])
      mockDecryptMessage.mockRejectedValue(new Error("Bad cipher"))

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe("Failed to decrypt secret")
    })
  })

  // ---------------------------------------------------------------
  // 10. Successful send to all recipients
  // ---------------------------------------------------------------
  describe("Successful send", () => {
    it("sends to all recipients and returns success with triggered status", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] }, // lock
        { type: "insert", result: [{ id: "log-1" }] }, // disclosure log insert
        { type: "update-no-return", result: undefined }, // final status update
      ])
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.sent).toBe(1)
      expect(data.failed).toBe(0)

      // Verify decryption was called with correct args
      expect(mockDecryptMessage).toHaveBeenCalledWith(
        BASE_SECRET.serverShare,
        expect.any(Buffer),
        expect.any(Buffer),
        BASE_SECRET.keyVersion,
      )

      // Verify email was sent with correct params
      expect(mockSendSecretDisclosureEmail).toHaveBeenCalledWith({
        contactEmail: BASE_RECIPIENT.email,
        contactName: BASE_RECIPIENT.name,
        secretTitle: BASE_SECRET.title,
        senderName: BASE_USER.name,
        message:
          "This secret was sent immediately by the owner after a failed delivery attempt.",
        secretContent: "decrypted-secret-content",
        disclosureReason: "manual",
        senderLastSeen: BASE_SECRET.lastCheckIn,
        secretCreatedAt: BASE_SECRET.createdAt,
      })

      // Verify disclosure log was updated to "sent"
      expect(mockUpdateDisclosureLog).toHaveBeenCalledWith(
        mockDb,
        "log-1",
        "sent",
      )
    })

    it("uses user email as sender name when user.name is null", async () => {
      const userNoName = { ...BASE_USER, name: null }
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [userNoName] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "insert", result: [{ id: "log-1" }] },
        { type: "update-no-return", result: undefined },
      ])
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT])

      const { POST } = await import("../+server")
      await POST(createEvent())

      expect(mockSendSecretDisclosureEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          senderName: userNoName.email,
        }),
      )
    })

    it("sends to multiple recipients successfully", async () => {
      const recipient2 = {
        id: "recipient-2",
        secretId: TEST_SECRET_ID,
        name: "Bob",
        email: "bob@example.com",
      }

      let insertIdx = 0
      const insertResults = [
        [{ id: "log-1" }],
        [{ id: "log-2" }],
      ]

      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "update-no-return", result: undefined }, // final status
      ])
      // Override insert to return different log IDs per call
      mockInsert.mockImplementation(() => ({
        values: () => ({
          returning: () => ({
            onConflictDoNothing: () => insertResults[insertIdx++] ?? [],
          }),
        }),
      }))
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT, recipient2])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.sent).toBe(2)
      expect(data.failed).toBe(0)
      expect(mockSendSecretDisclosureEmail).toHaveBeenCalledTimes(2)
    })
  })

  // ---------------------------------------------------------------
  // 11. Partial failure
  // ---------------------------------------------------------------
  describe("Partial failure", () => {
    it("handles partial failure when some emails fail", async () => {
      const recipient2 = {
        id: "recipient-2",
        secretId: TEST_SECRET_ID,
        name: "Bob",
        email: "bob@example.com",
      }

      let insertIdx = 0
      const insertResults = [
        [{ id: "log-1" }],
        [{ id: "log-2" }],
      ]

      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "update-no-return", result: undefined }, // final status (failed)
      ])
      mockInsert.mockImplementation(() => ({
        values: () => ({
          returning: () => ({
            onConflictDoNothing: () => insertResults[insertIdx++] ?? [],
          }),
        }),
      }))
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT, recipient2])

      // First email succeeds, second fails
      mockSendSecretDisclosureEmail
        .mockResolvedValueOnce({ success: true, messageId: "msg-1" })
        .mockResolvedValueOnce({
          success: false,
          error: "Mailbox full",
          provider: "sendgrid",
        })

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.sent).toBe(1)
      expect(data.failed).toBe(1)
      expect(data.error).toBe("Failed to send to 1 recipient(s)")

      // Verify first log updated as sent, second as failed
      expect(mockUpdateDisclosureLog).toHaveBeenCalledWith(
        mockDb,
        "log-1",
        "sent",
      )
      expect(mockUpdateDisclosureLog).toHaveBeenCalledWith(
        mockDb,
        "log-2",
        "failed",
        "Mailbox full",
      )

      // Verify failure was logged
      expect(mockLogEmailFailure).toHaveBeenCalledWith({
        emailType: "disclosure",
        provider: "sendgrid",
        recipient: "bob@example.com",
        subject: `Secret Disclosure: ${BASE_SECRET.title}`,
        errorMessage: "Mailbox full",
      })
    })

    it("handles email send throwing an exception", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "insert", result: [{ id: "log-1" }] },
        { type: "update-no-return", result: undefined },
      ])
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT])
      mockSendSecretDisclosureEmail.mockRejectedValue(
        new Error("Network timeout"),
      )

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.sent).toBe(0)
      expect(data.failed).toBe(1)

      // Verify disclosure log updated with error
      expect(mockUpdateDisclosureLog).toHaveBeenCalledWith(
        mockDb,
        "log-1",
        "failed",
        "Network timeout",
      )

      // Verify failure logged
      expect(mockLogEmailFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: "Network timeout",
          provider: "sendgrid",
        }),
      )
    })

    it("skips recipients with empty email", async () => {
      const noEmailRecipient = { ...BASE_RECIPIENT, email: "" }
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "update-no-return", result: undefined },
      ])
      mockGetAllRecipients.mockResolvedValue([noEmailRecipient])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      // Recipient is skipped (no email), so sent=0, failed=0
      // allSent = (0 === 1 && 0 === 0) = false, so status 500
      expect(response.status).toBe(500)
      expect(mockSendSecretDisclosureEmail).not.toHaveBeenCalled()
    })

    it("counts already-disclosed recipient (conflict) as sent", async () => {
      setupDbSequence([
        { type: "select", result: [BASE_SECRET] },
        { type: "select", result: [BASE_USER] },
        { type: "update", result: [{ id: TEST_SECRET_ID }] },
        { type: "insert", result: [] }, // onConflictDoNothing returns empty
        { type: "update-no-return", result: undefined },
      ])
      mockGetAllRecipients.mockResolvedValue([BASE_RECIPIENT])

      const { POST } = await import("../+server")
      const response = await POST(createEvent())

      // Conflict means already sent — counted as sent, no email dispatched
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.sent).toBe(1)
      expect(mockSendSecretDisclosureEmail).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------
  // 12. Unexpected error
  // ---------------------------------------------------------------
  describe("Unexpected errors", () => {
    it("returns 500 on unexpected error", async () => {
      // Make getDatabase throw
      const { getDatabase } = await import("$lib/db/drizzle")
      ;(getDatabase as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB connection lost"),
      )

      // Need CSRF + auth to pass first
      const event = createEvent()

      const { POST } = await import("../+server")
      const response = await POST(event)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe("Internal server error")
    })
  })
})
