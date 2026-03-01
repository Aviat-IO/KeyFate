/**
 * Tests for POST /api/secrets/[id]/publish-nostr
 *
 * Verifies that the endpoint correctly validates input, checks ownership,
 * calls publishSharesToNostr, and returns the expected response shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mocks ---

// Mock @sveltejs/kit
vi.mock("@sveltejs/kit", () => ({
  json: (data: unknown, init?: { status?: number }) =>
    new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  error: (status: number, message: string) => {
    const err = new Error(message) as any
    err.status = status
    throw err
  },
}))

// Mock requireSession
const mockRequireSession = vi.fn()
vi.mock("$lib/server/auth", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}))

// Mock database
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockDb = {
  select: mockSelect,
}
vi.mock("$lib/db/drizzle", () => ({
  getDatabase: vi.fn(async () => mockDb),
}))

// Mock schema (just need the table references for eq/and)
vi.mock("$lib/db/schema", () => ({
  secrets: { id: "id", userId: "user_id" },
  secretRecipients: {
    id: "id",
    secretId: "secret_id",
    nostrPubkey: "nostr_pubkey",
  },
}))

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}))

// Mock publishSharesToNostr
const mockPublishSharesToNostr = vi.fn()
vi.mock("$lib/services/nostr-publisher", () => ({
  publishSharesToNostr: (...args: unknown[]) =>
    mockPublishSharesToNostr(...args),
}))

// Mock nostr-tools
vi.mock("nostr-tools/pure", () => ({
  generateSecretKey: vi.fn(() => new Uint8Array(32).fill(0xab)),
}))

// Mock @scure/base
vi.mock("@scure/base", () => ({
  hex: {
    decode: vi.fn((s: string) => {
      // Simple hex decode for testing
      const bytes = new Uint8Array(s.length / 2)
      for (let i = 0; i < s.length; i += 2) {
        bytes[i / 2] = parseInt(s.substring(i, i + 2), 16)
      }
      return bytes
    }),
    encode: vi.fn((bytes: Uint8Array) =>
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ),
  },
}))

// --- Helpers ---

const TEST_USER_ID = "user-123"
const TEST_SECRET_ID = "550e8400-e29b-41d4-a716-446655440000"
const TEST_RECIPIENT_ID = "660e8400-e29b-41d4-a716-446655440001"
const TEST_RECIPIENT_ID_2 = "660e8400-e29b-41d4-a716-446655440002"
const TEST_NOSTR_PUBKEY =
  "a".repeat(64) // 64-char hex pubkey

function createMockEvent(body: unknown) {
  return {
    params: { id: TEST_SECRET_ID },
    request: new Request("http://localhost/api/secrets/test/publish-nostr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals: {
      auth: vi.fn(),
    },
    url: new URL("http://localhost/api/secrets/test/publish-nostr"),
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => "",
    },
    fetch: globalThis.fetch,
    getClientAddress: () => "127.0.0.1",
    platform: {},
    route: { id: "/api/secrets/[id]/publish-nostr" },
    isDataRequest: false,
    isSubRequest: false,
  }
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    shares: [
      {
        share: "deadbeef01",
        shareIndex: 1,
        recipientId: TEST_RECIPIENT_ID,
      },
    ],
    threshold: 2,
    totalShares: 3,
    ...overrides,
  }
}

// --- Setup ---

function setupDbChain(results: unknown[]) {
  // Each call to db.select() starts a chain: .select(columns?).from(table).where(cond)
  // We need to support multiple calls (one for secret, one for recipients)
  let callIndex = 0
  mockSelect.mockImplementation((..._args: unknown[]) => ({
    from: () => ({
      where: () => results[callIndex++] ?? [],
    }),
  }))
}

describe("POST /api/secrets/[id]/publish-nostr", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    mockRequireSession.mockResolvedValue({
      user: { id: TEST_USER_ID },
    })

    // Default: no NOSTR_SERVER_SECRET_KEY env var
    delete process.env.NOSTR_SERVER_SECRET_KEY
  })

  describe("Authentication", () => {
    it("should throw 401 when not authenticated", async () => {
      mockRequireSession.mockRejectedValue(
        Object.assign(new Error("Unauthorized"), { status: 401 }),
      )

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      await expect(POST(event as any)).rejects.toMatchObject({ status: 401 })
    })
  })

  describe("Validation", () => {
    it("should return 400 for empty shares array", async () => {
      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload({ shares: [] }))

      const response = await POST(event as any)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe("Invalid request data")
    })

    it("should return 400 for missing threshold", async () => {
      const { POST } = await import("../+server")
      const payload = validPayload()
      delete (payload as any).threshold
      const event = createMockEvent(payload)

      const response = await POST(event as any)
      expect(response.status).toBe(400)
    })

    it("should return 400 for invalid recipientId format", async () => {
      const { POST } = await import("../+server")
      const event = createMockEvent(
        validPayload({
          shares: [
            {
              share: "deadbeef",
              shareIndex: 1,
              recipientId: "not-a-uuid",
            },
          ],
        }),
      )

      const response = await POST(event as any)
      expect(response.status).toBe(400)
    })

    it("should return 400 for threshold below minimum", async () => {
      const { POST } = await import("../+server")
      const event = createMockEvent(
        validPayload({ threshold: 1, totalShares: 3 }),
      )

      const response = await POST(event as any)
      expect(response.status).toBe(400)
    })

    it("should return 400 for totalShares above maximum", async () => {
      const { POST } = await import("../+server")
      const event = createMockEvent(
        validPayload({ threshold: 2, totalShares: 8 }),
      )

      const response = await POST(event as any)
      expect(response.status).toBe(400)
    })

    it("should return 400 for negative shareIndex", async () => {
      const { POST } = await import("../+server")
      const event = createMockEvent(
        validPayload({
          shares: [
            {
              share: "deadbeef",
              shareIndex: -1,
              recipientId: TEST_RECIPIENT_ID,
            },
          ],
        }),
      )

      const response = await POST(event as any)
      expect(response.status).toBe(400)
    })
  })

  describe("Authorization", () => {
    it("should return 404 when secret does not belong to user", async () => {
      setupDbChain([
        [], // secret not found
      ])

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      const response = await POST(event as any)
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toBe("Secret not found")
    })

    it("should return 400 when recipientId does not belong to secret", async () => {
      setupDbChain([
        [{ id: TEST_SECRET_ID }], // secret found
        [{ id: "other-recipient-id", nostrPubkey: TEST_NOSTR_PUBKEY }], // different recipient
      ])

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      const response = await POST(event as any)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain("does not belong to this secret")
    })
  })

  describe("Publishing", () => {
    it("should call publishSharesToNostr with correct params", async () => {
      setupDbChain([
        [{ id: TEST_SECRET_ID }], // secret found
        [{ id: TEST_RECIPIENT_ID, nostrPubkey: TEST_NOSTR_PUBKEY }], // recipient
      ])

      mockPublishSharesToNostr.mockResolvedValue({
        published: [
          {
            recipientId: TEST_RECIPIENT_ID,
            nostrEventId: "event-id-123",
            plaintextK: new Uint8Array([0xde, 0xad]),
          },
        ],
        skipped: [],
        errors: [],
      })

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      const response = await POST(event as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.published).toHaveLength(1)
      expect(data.published[0].recipientId).toBe(TEST_RECIPIENT_ID)
      expect(data.published[0].nostrEventId).toBe("event-id-123")
      expect(data.published[0].plaintextK).toBe("dead")
      expect(data.skipped).toEqual([])
      expect(data.errors).toEqual([])

      // Verify publishSharesToNostr was called with correct structure
      expect(mockPublishSharesToNostr).toHaveBeenCalledTimes(1)
      const callArgs = mockPublishSharesToNostr.mock.calls[0][0]
      expect(callArgs.secretId).toBe(TEST_SECRET_ID)
      expect(callArgs.shares).toEqual([
        {
          share: "deadbeef01",
          shareIndex: 1,
          recipientId: TEST_RECIPIENT_ID,
        },
      ])
      expect(callArgs.threshold).toBe(2)
      expect(callArgs.totalShares).toBe(3)
      expect(callArgs.senderSecretKey).toBeInstanceOf(Uint8Array)
      expect(callArgs.recipients).toEqual([
        { id: TEST_RECIPIENT_ID, nostrPubkey: TEST_NOSTR_PUBKEY },
      ])
    })

    it("should return 422 when no shares were published", async () => {
      setupDbChain([
        [{ id: TEST_SECRET_ID }],
        [{ id: TEST_RECIPIENT_ID, nostrPubkey: null }], // no nostr pubkey
      ])

      mockPublishSharesToNostr.mockResolvedValue({
        published: [],
        skipped: [TEST_RECIPIENT_ID],
        errors: [],
      })

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      const response = await POST(event as any)
      expect(response.status).toBe(422)

      const data = await response.json()
      expect(data.published).toEqual([])
      expect(data.skipped).toContain(TEST_RECIPIENT_ID)
    })

    it("should use NOSTR_SERVER_SECRET_KEY from env when set", async () => {
      const testKey = "ab".repeat(32) // 64-char hex = 32 bytes
      process.env.NOSTR_SERVER_SECRET_KEY = testKey

      setupDbChain([
        [{ id: TEST_SECRET_ID }],
        [{ id: TEST_RECIPIENT_ID, nostrPubkey: TEST_NOSTR_PUBKEY }],
      ])

      mockPublishSharesToNostr.mockResolvedValue({
        published: [
          {
            recipientId: TEST_RECIPIENT_ID,
            nostrEventId: "event-456",
            plaintextK: new Uint8Array([0xff]),
          },
        ],
        skipped: [],
        errors: [],
      })

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      await POST(event as any)

      const callArgs = mockPublishSharesToNostr.mock.calls[0][0]
      // The key should be decoded from the env var hex
      expect(callArgs.senderSecretKey).toBeInstanceOf(Uint8Array)
      expect(callArgs.senderSecretKey.length).toBe(32)
    })

    it("should handle publish errors gracefully", async () => {
      setupDbChain([
        [{ id: TEST_SECRET_ID }],
        [{ id: TEST_RECIPIENT_ID, nostrPubkey: TEST_NOSTR_PUBKEY }],
      ])

      mockPublishSharesToNostr.mockResolvedValue({
        published: [],
        skipped: [],
        errors: [
          {
            recipientId: TEST_RECIPIENT_ID,
            error: "Relay connection failed",
          },
        ],
      })

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      const response = await POST(event as any)
      expect(response.status).toBe(422)

      const data = await response.json()
      expect(data.errors).toHaveLength(1)
      expect(data.errors[0].error).toBe("Relay connection failed")
    })

    it("should handle multiple shares for multiple recipients", async () => {
      setupDbChain([
        [{ id: TEST_SECRET_ID }],
        [
          { id: TEST_RECIPIENT_ID, nostrPubkey: TEST_NOSTR_PUBKEY },
          { id: TEST_RECIPIENT_ID_2, nostrPubkey: "b".repeat(64) },
        ],
      ])

      mockPublishSharesToNostr.mockResolvedValue({
        published: [
          {
            recipientId: TEST_RECIPIENT_ID,
            nostrEventId: "event-1",
            plaintextK: new Uint8Array([0x01]),
          },
          {
            recipientId: TEST_RECIPIENT_ID_2,
            nostrEventId: "event-2",
            plaintextK: new Uint8Array([0x02]),
          },
        ],
        skipped: [],
        errors: [],
      })

      const { POST } = await import("../+server")
      const event = createMockEvent({
        shares: [
          {
            share: "share1hex",
            shareIndex: 1,
            recipientId: TEST_RECIPIENT_ID,
          },
          {
            share: "share2hex",
            shareIndex: 2,
            recipientId: TEST_RECIPIENT_ID_2,
          },
        ],
        threshold: 2,
        totalShares: 3,
      })

      const response = await POST(event as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.published).toHaveLength(2)
    })
  })

  describe("Error handling", () => {
    it("should return 500 on unexpected errors", async () => {
      setupDbChain([
        [{ id: TEST_SECRET_ID }],
        [{ id: TEST_RECIPIENT_ID, nostrPubkey: TEST_NOSTR_PUBKEY }],
      ])

      mockPublishSharesToNostr.mockRejectedValue(
        new Error("Unexpected crypto failure"),
      )

      const { POST } = await import("../+server")
      const event = createMockEvent(validPayload())

      const response = await POST(event as any)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe("Internal server error")
    })
  })
})
