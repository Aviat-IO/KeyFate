/**
 * Tests for health endpoint authentication
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET as healthGet } from "../route"
import { GET as cronHealthGet } from "../cron/route"
import { GET as poolHealthGet } from "../pool/route"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/db/connection", () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/db/get-database", () => ({
  getDatabaseStats: vi.fn().mockReturnValue({
    connected: true,
    activeQueries: 0,
    totalConnections: 5,
    totalErrors: 0,
    circuitBreakerOpen: false,
    isShuttingDown: false,
  }),
}))

vi.mock("@/lib/email/email-service", () => ({
  getEmailServiceHealth: vi.fn().mockReturnValue({
    state: "CLOSED",
    failureCount: 0,
    lastFailureTime: null,
  }),
}))

vi.mock("@/lib/monitoring/cron-monitor", () => ({
  cronMonitor: {
    getAllStats: vi.fn().mockReturnValue({}),
  },
}))

vi.mock("@/lib/cron/utils", () => ({
  authorizeRequest: vi.fn((req: NextRequest) => {
    const authHeader = req.headers.get("authorization")
    return authHeader === "Bearer test-secret"
  }),
}))

describe("Health endpoint authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("/api/health", () => {
    it("should allow unauthenticated access to basic health", async () => {
      const req = new NextRequest("http://localhost:3000/api/health")

      const response = await healthGet(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBeDefined()
      expect(data.checks).toBeDefined()
    })

    it("should require auth for detailed health", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/health?detailed=true",
      )

      const response = await healthGet(req)

      expect(response.status).toBe(401)
    })

    it("should allow authenticated access to detailed health", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/health?detailed=true",
        {
          headers: {
            authorization: "Bearer test-secret",
          },
        },
      )

      const response = await healthGet(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.database).toBeDefined()
      expect(data.email).toBeDefined()
    })
  })

  describe("/api/health/cron", () => {
    it("should require authentication", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/cron")

      const response = await cronHealthGet(req)

      expect(response.status).toBe(401)
    })

    it("should allow authenticated access", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/cron", {
        headers: {
          authorization: "Bearer test-secret",
        },
      })

      const response = await cronHealthGet(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBeDefined()
      expect(data.jobs).toBeDefined()
    })
  })

  describe("/api/health/pool", () => {
    it("should require authentication", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/pool")

      const response = await poolHealthGet(req)

      expect(response.status).toBe(401)
    })

    it("should allow authenticated access", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/pool", {
        headers: {
          authorization: "Bearer test-secret",
        },
      })

      const response = await poolHealthGet(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBeDefined()
      expect(data.pool).toBeDefined()
    })
  })
})
