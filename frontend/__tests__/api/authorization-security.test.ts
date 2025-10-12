/**
 * Authorization Security Integration Tests
 *
 * Test-Driven Development approach for API route protection
 * Validates that all protected routes enforce proper authorization
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Import setup to apply mocks
import "./setup"

import { getServerSession } from "next-auth/next"
import { secretsService } from "@/lib/db/drizzle"

// Mock user verification
vi.mock("@/lib/auth/user-verification", () => ({
  ensureUserExists: vi.fn().mockResolvedValue({ exists: true, created: false }),
}))

// Mock subscription tier functions
vi.mock("@/lib/subscription", () => ({
  canUserCreateSecret: vi.fn().mockResolvedValue(true),
  getUserTierInfo: vi.fn().mockResolvedValue({
    tier: {
      tiers: {
        name: "free",
        max_secrets: 1,
        max_recipients_per_secret: 1,
        custom_intervals: false,
      },
    },
    limits: {
      secrets: { canCreate: true, current: 0, max: 1 },
      recipients: { current: 0, max: 1 },
    },
    usage: { secrets_count: 0, total_recipients: 0 },
  }),
  isIntervalAllowed: vi.fn().mockReturnValue(true),
  calculateUserUsage: vi
    .fn()
    .mockResolvedValue({ secrets_count: 0, total_recipients: 0 }),
  getTierLimits: vi.fn().mockReturnValue({
    maxSecrets: 1,
    maxRecipientsPerSecret: 1,
    customIntervals: false,
  }),
  getAvailableIntervals: vi.fn().mockReturnValue([
    { days: 7, label: "1 week" },
    { days: 30, label: "1 month" },
    { days: 365, label: "1 year" },
  ]),
}))

// Import API route handlers AFTER mocks
import {
  GET as getSecret,
  DELETE as deleteSecret,
} from "@/app/api/secrets/[id]/route"
import { POST as createSecret } from "@/app/api/secrets/route"

const mockGetServerSession = vi.mocked(getServerSession)
const mockSecretsService = vi.mocked(secretsService)

describe("Authorization Security - API Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset to authenticated state by default
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123", email: "owner@example.com" },
    } as any)
  })

  describe("Secrets API - GET /api/secrets/[id]", () => {
    it("should reject unauthenticated requests with 401", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await getSecret(mockRequest, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty("error", "Unauthorized")
    })

    it("should allow user to access their own secret", async () => {
      const mockSession = {
        user: { id: "user-123", email: "owner@example.com" },
      }

      mockGetServerSession.mockResolvedValue(mockSession as any)

      const mockSecret = {
        id: "secret-123",
        userId: "user-123",
        title: "My Secret",
        recipientName: "John Doe",
      }

      mockSecretsService.getById = vi.fn().mockResolvedValue(mockSecret)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await getSecret(mockRequest, { params })

      expect(response.status).toBe(200)
      expect(mockSecretsService.getById).toHaveBeenCalledWith(
        "secret-123",
        "user-123",
      )
    })

    it("should prevent cross-user secret access", async () => {
      const mockSession = {
        user: { id: "user-456", email: "attacker@example.com" },
      }

      mockGetServerSession.mockResolvedValue(mockSession as any)

      // Mock secretsService to return null (user doesn't own it)
      mockSecretsService.getById = vi.fn().mockResolvedValue(null)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await getSecret(mockRequest, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty("error", "Secret not found")
      expect(mockSecretsService.getById).toHaveBeenCalledWith(
        "secret-123",
        "user-456",
      )
    })
  })

  describe("Secrets API - DELETE /api/secrets/[id]", () => {
    it("should reject unauthenticated delete requests", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
        {
          method: "DELETE",
        },
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await deleteSecret(mockRequest, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty("error", "Unauthorized")
    })

    it("should prevent user from deleting another user's secret", async () => {
      const mockSession = {
        user: { id: "user-456", email: "attacker@example.com" },
      }

      mockGetServerSession.mockResolvedValue(mockSession as any)

      // Mock secretsService to return null (user doesn't own it)
      mockSecretsService.getById = vi.fn().mockResolvedValue(null)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
        {
          method: "DELETE",
        },
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await deleteSecret(mockRequest, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty("error", "Secret not found")
      expect(mockSecretsService.getById).toHaveBeenCalledWith(
        "secret-123",
        "user-456",
      )
    })
  })

  describe("Secrets API - POST /api/secrets", () => {
    it("should reject unauthenticated create requests", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const requestBody = {
        title: "New Secret",
        recipients: [{ name: "John Doe", email: "john@example.com" }],
        check_in_days: 30,
        server_share: "encrypted-share",
        sss_shares_total: 3,
        sss_threshold: 2,
      }

      const mockRequest = new NextRequest("http://localhost:3000/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const response = await createSecret(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty("error", "Unauthorized")
    })

    it("should associate created secret with authenticated user", async () => {
      const mockSession = {
        user: { id: "user-123", email: "owner@example.com" },
      }

      mockGetServerSession.mockResolvedValue(mockSession as any)

      const mockCreatedSecret = {
        id: "secret-new",
        userId: "user-123",
        title: "New Secret",
        recipientName: "John Doe",
      }

      mockSecretsService.create = vi.fn().mockResolvedValue(mockCreatedSecret)

      const requestBody = {
        title: "New Secret",
        recipients: [{ name: "John Doe", email: "john@example.com" }],
        check_in_days: 30,
        server_share: "plain-text-share",
        sss_shares_total: 3,
        sss_threshold: 2,
      }

      const mockRequest = new NextRequest("http://localhost:3000/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const response = await createSecret(mockRequest)

      // Should succeed with authentication
      expect(mockGetServerSession).toHaveBeenCalled()
      expect(response.status).toBe(201)
    })
  })

  describe("Authorization Error Responses", () => {
    it("should return clear error messages for unauthorized access", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await getSecret(mockRequest, { params })
      const data = await response.json()

      expect(data).toHaveProperty("error")
      expect(typeof data.error).toBe("string")
      expect(data.error.length).toBeGreaterThan(0)
    })

    it("should not leak secret existence in authorization errors", async () => {
      const mockSession = {
        user: { id: "user-456", email: "attacker@example.com" },
      }

      mockGetServerSession.mockResolvedValue(mockSession as any)

      mockSecretsService.getById = vi.fn().mockResolvedValue(null)

      const mockRequest = new NextRequest(
        "http://localhost:3000/api/secrets/secret-123",
      )
      const params = Promise.resolve({ id: "secret-123" })

      const response = await getSecret(mockRequest, { params })
      const data = await response.json()

      // Should return 404, not 403, to avoid leaking secret existence
      expect(response.status).toBe(404)
      expect(data.error).toBe("Secret not found")
    })
  })
})
