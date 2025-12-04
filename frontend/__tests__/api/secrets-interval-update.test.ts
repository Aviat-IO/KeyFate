/**
 * Secret Interval Update Integration Tests
 *
 * Tests for automatic check-in when editing secret intervals
 * Validates that changing check_in_days triggers auto check-in and recalculates nextCheckIn
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"

vi.mock("next-auth/next")

vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
  secretsService: {
    getById: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/auth-config", () => ({
  authConfig: {},
}))

vi.mock("@/lib/csrf", () => ({
  requireCSRFProtection: vi.fn().mockResolvedValue({ valid: true }),
  createCSRFErrorResponse: vi.fn(),
}))

vi.mock("@/lib/auth/require-email-verification", () => ({
  requireEmailVerification: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/auth/user-verification", () => ({
  ensureUserExists: vi.fn().mockResolvedValue({ exists: true, created: false }),
}))

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
}))

vi.mock("@/lib/services/audit-logger", () => ({
  logSecretEdited: vi.fn().mockResolvedValue(undefined),
  logCheckIn: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/db/queries/secrets", () => ({
  getSecretWithRecipients: vi.fn(),
  updateSecretRecipients: vi.fn().mockResolvedValue(undefined),
}))

import { secretsService, getDatabase } from "@/lib/db/drizzle"
import { checkinHistory } from "@/lib/db/schema"
import { PUT as updateSecret } from "@/app/api/secrets/[id]/route"
import { getSecretWithRecipients } from "@/lib/db/queries/secrets"

const mockGetServerSession = vi.mocked(getServerSession)
const mockSecretsService = vi.mocked(secretsService)
const mockGetSecretWithRecipients = vi.mocked(getSecretWithRecipients)

describe("Secret Interval Update - Auto Check-in", () => {
  const mockUserId = "user-123"
  const mockSecretId = "secret-456"
  const mockSession = {
    user: { id: mockUserId, email: "test@example.com" },
  }

  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession as any)

    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    }
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("When check_in_days changes", () => {
    it("should apply automatic check-in and recalculate nextCheckIn", async () => {
      const oldCheckInDays = 2
      const newCheckInDays = 7
      const now = new Date("2025-10-14T12:00:00Z")
      vi.setSystemTime(now)

      const existingSecret = {
        id: mockSecretId,
        userId: mockUserId,
        title: "Test Secret",
        checkInDays: oldCheckInDays,
        lastCheckIn: new Date("2025-10-13T12:00:00Z"),
        nextCheckIn: new Date("2025-10-16T12:00:00Z"),
        status: "active",
        createdAt: new Date("2025-10-01T12:00:00Z"),
        updatedAt: new Date("2025-10-13T12:00:00Z"),
      }

      mockSecretsService.getById = vi.fn().mockResolvedValue(existingSecret)

      const updatedSecretAfterIntervalChange = {
        ...existingSecret,
        checkInDays: newCheckInDays,
      }
      mockSecretsService.update = vi
        .fn()
        .mockResolvedValueOnce(updatedSecretAfterIntervalChange)
        .mockResolvedValueOnce({
          ...updatedSecretAfterIntervalChange,
          lastCheckIn: now,
          nextCheckIn: new Date(
            now.getTime() + newCheckInDays * 24 * 60 * 60 * 1000,
          ),
        })

      const updatedSecretWithRecipients = {
        ...updatedSecretAfterIntervalChange,
        lastCheckIn: now,
        nextCheckIn: new Date(
          now.getTime() + newCheckInDays * 24 * 60 * 60 * 1000,
        ),
        recipients: [{ name: "John Doe", email: "john@example.com" }],
      }
      mockGetSecretWithRecipients.mockResolvedValue(
        updatedSecretWithRecipients as any,
      )

      const updatePayload = {
        title: "Test Secret",
        recipients: [{ name: "John Doe", email: "john@example.com" }],
        check_in_days: newCheckInDays,
      }

      const mockRequest = new NextRequest(
        `http://localhost:3000/api/secrets/${mockSecretId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        },
      )
      const params = Promise.resolve({ id: mockSecretId })

      const response = await updateSecret(mockRequest, { params })
      const data = await response.json()

      expect(response.status).toBe(200)

      expect(mockSecretsService.getById).toHaveBeenCalledWith(
        mockSecretId,
        mockUserId,
      )

      expect(mockSecretsService.update).toHaveBeenCalledWith(
        mockSecretId,
        mockUserId,
        {
          title: "Test Secret",
          checkInDays: newCheckInDays,
        },
      )

      expect(mockSecretsService.update).toHaveBeenCalledWith(
        mockSecretId,
        mockUserId,
        expect.objectContaining({
          lastCheckIn: now,
          nextCheckIn: expect.any(Date),
        }),
      )

      const secondUpdateCall = mockSecretsService.update.mock.calls[1]
      const updatedNextCheckIn = secondUpdateCall[2].nextCheckIn as Date
      const expectedNextCheckIn = new Date(
        now.getTime() + newCheckInDays * 24 * 60 * 60 * 1000,
      )
      expect(updatedNextCheckIn.getTime()).toBe(expectedNextCheckIn.getTime())

      expect(mockDb.insert).toHaveBeenCalledWith(checkinHistory)
      const insertCall = mockDb.insert.mock.results[0].value
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          secretId: mockSecretId,
          userId: mockUserId,
          checkedInAt: now,
          nextCheckIn: expectedNextCheckIn,
        }),
      )

      vi.useRealTimers()
    })

    it("should NOT apply auto check-in when check_in_days remains the same", async () => {
      const checkInDays = 7
      const now = new Date("2025-10-14T12:00:00Z")
      vi.setSystemTime(now)

      const existingSecret = {
        id: mockSecretId,
        userId: mockUserId,
        title: "Test Secret",
        checkInDays: checkInDays,
        lastCheckIn: new Date("2025-10-13T12:00:00Z"),
        nextCheckIn: new Date("2025-10-20T12:00:00Z"),
        status: "active",
        createdAt: new Date("2025-10-01T12:00:00Z"),
        updatedAt: new Date("2025-10-13T12:00:00Z"),
      }

      mockSecretsService.getById = vi.fn().mockResolvedValue(existingSecret)

      const updatedSecret = {
        ...existingSecret,
        title: "Updated Title",
      }
      mockSecretsService.update = vi.fn().mockResolvedValue(updatedSecret)

      const updatedSecretWithRecipients = {
        ...updatedSecret,
        recipients: [{ name: "John Doe", email: "john@example.com" }],
      }
      mockGetSecretWithRecipients.mockResolvedValue(
        updatedSecretWithRecipients as any,
      )

      const updatePayload = {
        title: "Updated Title",
        recipients: [{ name: "John Doe", email: "john@example.com" }],
        check_in_days: checkInDays,
      }

      const mockRequest = new NextRequest(
        `http://localhost:3000/api/secrets/${mockSecretId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        },
      )
      const params = Promise.resolve({ id: mockSecretId })

      const response = await updateSecret(mockRequest, { params })

      expect(response.status).toBe(200)

      expect(mockSecretsService.update).toHaveBeenCalledTimes(1)

      expect(mockSecretsService.update).toHaveBeenCalledWith(
        mockSecretId,
        mockUserId,
        {
          title: "Updated Title",
          checkInDays: checkInDays,
        },
      )

      expect(mockDb.insert).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it("should calculate correct nextCheckIn for different intervals", async () => {
      const testCases = [
        { oldDays: 2, newDays: 7, label: "daily to weekly" },
        { oldDays: 7, newDays: 30, label: "weekly to monthly" },
        { oldDays: 30, newDays: 90, label: "monthly to quarterly" },
        { oldDays: 90, newDays: 365, label: "quarterly to yearly" },
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()

        const now = new Date("2025-10-14T12:00:00Z")
        vi.setSystemTime(now)

        const existingSecret = {
          id: mockSecretId,
          userId: mockUserId,
          title: "Test Secret",
          checkInDays: testCase.oldDays,
          lastCheckIn: new Date("2025-10-13T12:00:00Z"),
          nextCheckIn: new Date(
            Date.now() + testCase.oldDays * 24 * 60 * 60 * 1000,
          ),
          status: "active",
          createdAt: new Date("2025-10-01T12:00:00Z"),
          updatedAt: new Date("2025-10-13T12:00:00Z"),
        }

        mockSecretsService.getById = vi.fn().mockResolvedValue(existingSecret)

        const updatedSecret = {
          ...existingSecret,
          checkInDays: testCase.newDays,
        }
        mockSecretsService.update = vi
          .fn()
          .mockResolvedValueOnce(updatedSecret)
          .mockResolvedValueOnce({
            ...updatedSecret,
            lastCheckIn: now,
            nextCheckIn: new Date(
              now.getTime() + testCase.newDays * 24 * 60 * 60 * 1000,
            ),
          })

        const updatedSecretWithRecipients = {
          ...updatedSecret,
          lastCheckIn: now,
          nextCheckIn: new Date(
            now.getTime() + testCase.newDays * 24 * 60 * 60 * 1000,
          ),
          recipients: [{ name: "John Doe", email: "john@example.com" }],
        }
        mockGetSecretWithRecipients.mockResolvedValue(
          updatedSecretWithRecipients as any,
        )

        const updatePayload = {
          title: "Test Secret",
          recipients: [{ name: "John Doe", email: "john@example.com" }],
          check_in_days: testCase.newDays,
        }

        const mockRequest = new NextRequest(
          `http://localhost:3000/api/secrets/${mockSecretId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          },
        )
        const params = Promise.resolve({ id: mockSecretId })

        const response = await updateSecret(mockRequest, { params })

        expect(response.status).toBe(200)

        const secondUpdateCall = mockSecretsService.update.mock.calls[1]
        const updatedNextCheckIn = secondUpdateCall[2].nextCheckIn as Date
        const expectedNextCheckIn = new Date(
          now.getTime() + testCase.newDays * 24 * 60 * 60 * 1000,
        )

        expect(updatedNextCheckIn.getTime()).toBe(expectedNextCheckIn.getTime())

        vi.useRealTimers()
      }
    })
  })
})
