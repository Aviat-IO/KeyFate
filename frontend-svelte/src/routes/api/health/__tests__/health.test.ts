/**
 * Health endpoint tests for SvelteKit API route
 *
 * Ported from frontend/__tests__/api/health-database-endpoint.test.ts
 * Adapted for SvelteKit: tests the +server.ts GET handler directly.
 *
 * This serves as a template for testing SvelteKit API routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock all external dependencies before importing the handler
vi.mock("$lib/db/connection", () => ({
  checkDatabaseConnection: vi.fn(),
}))

vi.mock("$lib/db/drizzle", () => ({
  getDatabaseStats: vi.fn(),
}))

// Note: $lib/logger is NOT mocked here to avoid polluting logger.test.ts
// in Bun's shared module cache. The real logger runs but this test
// doesn't assert on logger calls.

vi.mock("$lib/email/email-service", () => ({
  getEmailServiceHealth: vi.fn(),
}))

vi.mock("$lib/cron/utils", () => ({
  authorizeRequest: vi.fn(),
}))

// Mock @sveltejs/kit json helper
vi.mock("@sveltejs/kit", () => ({
  json: (data: unknown, init?: { status?: number }) => {
    return new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    })
  },
}))

import { checkDatabaseConnection } from "$lib/db/connection"
import { getDatabaseStats } from "$lib/db/drizzle"
import { getEmailServiceHealth } from "$lib/email/email-service"

/**
 * Helper to create a mock SvelteKit RequestEvent for the health endpoint
 */
function createHealthEvent(options: { detailed?: boolean } = {}) {
  const url = new URL("http://localhost:5173/api/health")
  if (options.detailed) {
    url.searchParams.set("detailed", "true")
  }

  return {
    request: new Request(url.toString()),
    url,
    params: {},
    locals: {},
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
    route: { id: "/api/health" },
    isDataRequest: false,
    isSubRequest: false,
  }
}

describe("Health Endpoint (SvelteKit)", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock: healthy state
    ;(checkDatabaseConnection as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(getDatabaseStats as ReturnType<typeof vi.fn>).mockReturnValue({
      connected: true,
      activeQueries: 0,
      totalConnections: 1,
      totalErrors: 0,
      circuitBreakerOpen: false,
      isShuttingDown: false,
    } as any)
    ;(getEmailServiceHealth as ReturnType<typeof vi.fn>).mockReturnValue({
      state: "closed",
      failures: 0,
    } as any)

    // Mock process.env for health checks
    process.env.SENDGRID_API_KEY = "SG.test-key"
    process.env.ENCRYPTION_KEY = Buffer.from("a".repeat(32)).toString("base64")
  })

  describe("Basic Health Check (non-detailed)", () => {
    it("should return 200 for healthy services", async () => {
      // Dynamic import to get fresh module with mocks applied
      const { GET } = await import("../+server")

      const event = createHealthEvent()
      const response = await GET(event as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("healthy")
      expect(data.timestamp).toBeDefined()
      expect(data.checks).toBeDefined()
      expect(data.checks.database).toBe("healthy")
    })

    it("should include timestamp in response", async () => {
      const { GET } = await import("../+server")

      const event = createHealthEvent()
      const response = await GET(event as any)
      const data = await response.json()

      expect(data.timestamp).toBeDefined()
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
    })

    it("should return degraded when database is unhealthy", async () => {
      ;(checkDatabaseConnection as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const { GET } = await import("../+server")

      const event = createHealthEvent()
      const response = await GET(event as any)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.checks.database).toBe("unhealthy")
    })

    it("should return degraded when email is unconfigured", async () => {
      // Remove SendGrid API key to simulate unconfigured email
      delete process.env.SENDGRID_API_KEY

      const { GET } = await import("../+server")

      const event = createHealthEvent()
      const response = await GET(event as any)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.checks.email).toBe("unconfigured")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on unexpected error", async () => {
      ;(checkDatabaseConnection as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected failure"),
      )

      const { GET } = await import("../+server")

      const event = createHealthEvent()
      const response = await GET(event as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.status).toBe("error")
      // Error details are intentionally not leaked to clients
      expect(data.error).toBeUndefined()
    })
  })

  describe("Response Structure", () => {
    it("should have correct response structure for healthy state", async () => {
      const { GET } = await import("../+server")

      const event = createHealthEvent()
      const response = await GET(event as any)
      const data = await response.json()

      expect(data).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy|error)$/),
        timestamp: expect.any(String),
        checks: {
          database: expect.stringMatching(/^(healthy|unhealthy)$/),
          email: expect.stringMatching(/^(configured|unconfigured)$/),
          encryption: expect.stringMatching(/^(healthy|unhealthy)$/),
        },
      })
    })
  })
})
