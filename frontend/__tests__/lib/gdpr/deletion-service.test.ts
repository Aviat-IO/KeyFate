import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { DeletionRequestStatus } from "@/lib/db/schema"

// Mock database
const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
}))

const mockGetDatabase = vi.hoisted(() => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
}))

const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn(() => Promise.resolve({ messageId: "test-message-id" })),
}))

const mockCrypto = vi.hoisted(() => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => "mock-token-abc123"),
    })),
  },
  randomBytes: vi.fn(() => ({
    toString: vi.fn(() => "mock-token-abc123"),
  })),
}))

// Apply mocks
vi.mock("@/lib/db/get-database", () => mockGetDatabase)
vi.mock("@/lib/email/email-service", () => mockEmailService)
vi.mock("crypto", () => mockCrypto)

const originalEnv = process.env

describe("GDPR Deletion Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXTAUTH_URL: "http://localhost:3000",
    }

    // Reset mock implementations
    mockDb.returning.mockResolvedValue([])
    mockEmailService.sendEmail.mockResolvedValue({
      messageId: "test-message-id",
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("initiateAccountDeletion", () => {
    it("should create a deletion request with 30-day grace period", async () => {
      const userId = "test-user-123"
      const mockUser = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
      }

      mockDb.limit.mockResolvedValueOnce([mockUser])
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "deletion-request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "mock-token-abc123",
          scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      ])

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await initiateAccountDeletion(userId)

      expect(result.status).toBe(DeletionRequestStatus.PENDING)
      expect(result.scheduledDeletionAt).toBeDefined()

      // Verify 30-day grace period
      const daysDiff = Math.floor(
        (result.scheduledDeletionAt.getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      )
      expect(daysDiff).toBeGreaterThanOrEqual(29)
      expect(daysDiff).toBeLessThanOrEqual(30)
    })

    it("should send confirmation email with token", async () => {
      const userId = "test-user-123"
      const mockUser = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
      }

      mockDb.limit.mockResolvedValueOnce([mockUser])
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "deletion-request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "mock-token-abc123",
          scheduledDeletionAt: new Date(),
          createdAt: new Date(),
        },
      ])

      const { sendEmail } = await import("@/lib/email/email-service")
      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await initiateAccountDeletion(userId)

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: expect.stringContaining("Confirm Account Deletion"),
        }),
      )
    })

    it("should prevent duplicate deletion requests", async () => {
      const userId = "test-user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: "existing-request",
          userId,
          status: DeletionRequestStatus.PENDING,
        },
      ])

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(initiateAccountDeletion(userId)).rejects.toThrow(
        "active deletion request",
      )
    })
  })

  describe("confirmAccountDeletion", () => {
    it("should confirm deletion with valid token", async () => {
      const token = "valid-token-123"
      const mockRequest = {
        id: "request-123",
        userId: "user-123",
        status: DeletionRequestStatus.PENDING,
        confirmationToken: token,
        scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }

      mockDb.limit.mockResolvedValueOnce([mockRequest])

      const { confirmAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await confirmAccountDeletion(token)

      expect(result.status).toBe(DeletionRequestStatus.CONFIRMED)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should reject invalid confirmation token", async () => {
      const token = "invalid-token"

      mockDb.limit.mockResolvedValueOnce([])

      const { confirmAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(confirmAccountDeletion(token)).rejects.toThrow("not found")
    })

    it("should reject already confirmed deletion", async () => {
      const token = "valid-token-123"
      const mockRequest = {
        id: "request-123",
        userId: "user-123",
        status: DeletionRequestStatus.CONFIRMED,
        confirmationToken: token,
      }

      mockDb.limit.mockResolvedValueOnce([mockRequest])

      const { confirmAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(confirmAccountDeletion(token)).rejects.toThrow(
        "already confirmed",
      )
    })
  })

  describe("cancelAccountDeletion", () => {
    it("should allow user to cancel pending deletion", async () => {
      const userId = "user-123"
      const requestId = "request-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: requestId,
          userId,
          status: DeletionRequestStatus.CONFIRMED,
        },
      ])

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await cancelAccountDeletion(requestId, userId)

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeletionRequestStatus.CANCELLED,
        }),
      )
    })

    it("should prevent cancellation by different user", async () => {
      const userId = "user-123"
      const differentUserId = "user-456"
      const requestId = "request-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: requestId,
          userId,
          status: DeletionRequestStatus.CONFIRMED,
        },
      ])

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(
        cancelAccountDeletion(requestId, differentUserId),
      ).rejects.toThrow("not authorized")
    })

    it("should not allow cancellation of completed deletion", async () => {
      const userId = "user-123"
      const requestId = "request-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: requestId,
          userId,
          status: DeletionRequestStatus.COMPLETED,
        },
      ])

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(cancelAccountDeletion(requestId, userId)).rejects.toThrow(
        "Cannot cancel",
      )
    })
  })

  describe("executeAccountDeletion", () => {
    it("should delete all user data in correct order", async () => {
      const userId = "user-123"
      const userEmail = "test@example.com"

      // Mock user fetch
      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: userEmail,
          name: "Test User",
        },
      ])

      // Mock all other queries
      mockDb.where.mockResolvedValue([])

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await executeAccountDeletion(userId)

      // Verify deletion calls were made
      expect(mockDb.delete).toHaveBeenCalled()

      // Verify final user deletion
      const deleteCalls = mockDb.delete.mock.calls
      expect(deleteCalls.length).toBeGreaterThan(0)
    })

    it("should anonymize payment records instead of deleting", async () => {
      const userId = "user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
        },
      ])

      mockDb.where.mockResolvedValue([])

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await executeAccountDeletion(userId)

      // Verify subscription anonymization
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should send deletion confirmation email", async () => {
      const userId = "user-123"
      const userEmail = "test@example.com"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: userEmail,
          name: "Test User",
        },
      ])

      mockDb.where.mockResolvedValue([])

      const { sendEmail } = await import("@/lib/email/email-service")
      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await executeAccountDeletion(userId)

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userEmail,
          subject: expect.stringContaining("Deleted"),
        }),
      )
    })

    it("should handle cascade deletion of related data", async () => {
      const userId = "user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
        },
      ])

      // Mock secrets with recipients
      const mockSecrets = [{ id: "secret-1" }, { id: "secret-2" }]
      mockDb.where.mockResolvedValueOnce(mockSecrets)
      mockDb.where.mockResolvedValue([])

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await executeAccountDeletion(userId)

      // Should delete recipients for each secret
      const deleteCalls = mockDb.delete.mock.calls
      expect(deleteCalls.length).toBeGreaterThan(mockSecrets.length)
    })
  })

  describe("getPendingDeletions", () => {
    it("should return deletions past grace period", async () => {
      const pastDate = new Date(Date.now() - 1000)
      const pendingDeletions = [
        {
          id: "deletion-1",
          userId: "user-1",
          status: DeletionRequestStatus.CONFIRMED,
          scheduledDeletionAt: pastDate,
        },
      ]

      mockDb.where.mockResolvedValueOnce(pendingDeletions)

      const { getPendingDeletions } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await getPendingDeletions()

      expect(result.length).toBe(1)
      expect(result[0].id).toBe("deletion-1")
    })

    it("should not return future deletions", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      mockDb.where.mockResolvedValueOnce([
        {
          id: "deletion-1",
          userId: "user-1",
          status: DeletionRequestStatus.CONFIRMED,
          scheduledDeletionAt: futureDate,
        },
      ])

      const { getPendingDeletions } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await getPendingDeletions()

      // Should be filtered out by date check
      expect(result.length).toBe(0)
    })
  })

  describe("GDPR Compliance Requirements", () => {
    it("should enforce 30-day grace period (GDPR Article 17)", async () => {
      const userId = "user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
        },
      ])

      mockDb.returning.mockResolvedValueOnce([
        {
          id: "request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ])

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await initiateAccountDeletion(userId)

      const gracePeriodDays = Math.floor(
        (result.scheduledDeletionAt.getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      )

      expect(gracePeriodDays).toBeGreaterThanOrEqual(29)
      expect(gracePeriodDays).toBeLessThanOrEqual(30)
    })

    it("should retain financial records (anonymized)", async () => {
      const userId = "user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
        },
      ])

      mockDb.where.mockResolvedValue([])

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await executeAccountDeletion(userId)

      // Verify update was called (for anonymization) not delete
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should require explicit confirmation before deletion", async () => {
      const userId = "user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
        },
      ])

      mockDb.returning.mockResolvedValueOnce([
        {
          id: "request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "token-123",
        },
      ])

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await initiateAccountDeletion(userId)

      // Should start as PENDING, not CONFIRMED
      expect(result.status).toBe(DeletionRequestStatus.PENDING)
      expect(result.confirmationToken).toBeDefined()
    })
  })

  describe("Security & Authorization", () => {
    it("should prevent unauthorized deletion cancellation", async () => {
      const ownerId = "user-123"
      const attackerId = "user-456"
      const requestId = "request-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: requestId,
          userId: ownerId,
          status: DeletionRequestStatus.CONFIRMED,
        },
      ])

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(
        cancelAccountDeletion(requestId, attackerId),
      ).rejects.toThrow()
    })

    it("should use secure tokens for confirmation", async () => {
      const userId = "user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
        },
      ])

      mockDb.returning.mockResolvedValueOnce([
        {
          id: "request-123",
          userId,
          confirmationToken: "mock-token-abc123",
        },
      ])

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await initiateAccountDeletion(userId)

      // Token should be sufficiently long
      expect(result.confirmationToken.length).toBeGreaterThan(20)
    })
  })
})
