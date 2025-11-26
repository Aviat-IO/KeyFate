import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { DeletionRequestStatus } from "@/lib/db/schema"

// Create chainable mock that returns itself for chaining and resolves to data
function createChainableMock(resolveValue: unknown = []) {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {}

  const createMethod = (defaultValue: unknown) => {
    const fn = vi.fn(() => {
      // Return a new chainable proxy that resolves to the value
      return new Proxy(mock, {
        get(target, prop) {
          if (prop === "then") {
            // Make it thenable (Promise-like)
            return (resolve: (value: unknown) => void) => resolve(defaultValue)
          }
          return target[prop as string] || createMethod(defaultValue)
        },
      })
    })
    return fn
  }

  mock.select = createMethod(resolveValue)
  mock.from = createMethod(resolveValue)
  mock.where = createMethod(resolveValue)
  mock.orderBy = createMethod(resolveValue)
  mock.limit = createMethod(resolveValue)
  mock.insert = createMethod(resolveValue)
  mock.values = createMethod(resolveValue)
  mock.update = createMethod(resolveValue)
  mock.set = createMethod(resolveValue)
  mock.delete = createMethod(resolveValue)
  mock.returning = createMethod(resolveValue)

  return mock
}

// Track call sequences for verification
let insertReturningValue: unknown[] = []
let selectFromWhereValue: unknown[] = []
let deleteWasCalled = false
let updateWasCalled = false

const mockGetDatabase = vi.hoisted(() => {
  return {
    getDatabase: vi.fn(async () => {
      // Create a chainable mock that returns arrays
      const createSelectChain = (value: unknown) => {
        const chain: any = {
          from: vi.fn(() => chain),
          where: vi.fn(() => chain),
          orderBy: vi.fn(() => chain),
          limit: vi.fn(() => Promise.resolve(value)),
          then: (resolve: (v: unknown) => void) => resolve(value),
        }
        return chain
      }

      return {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve(insertReturningValue)),
          })),
        })),
        select: vi.fn(() => createSelectChain(selectFromWhereValue)),
        update: vi.fn(() => {
          updateWasCalled = true
          return {
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(() => Promise.resolve(insertReturningValue)),
              })),
            })),
          }
        }),
        delete: vi.fn(() => {
          deleteWasCalled = true
          return {
            where: vi.fn(() => Promise.resolve([])),
          }
        }),
      }
    }),
  }
})

const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn(() => Promise.resolve({ messageId: "test-message-id" })),
}))

// Apply mocks - don't mock crypto, use actual implementation
vi.mock("@/lib/db/get-database", () => mockGetDatabase)
vi.mock("@/lib/email/email-service", () => mockEmailService)

const originalEnv = process.env

describe("GDPR Deletion Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      NEXTAUTH_URL: "http://localhost:3000",
    }

    // Reset tracking variables
    insertReturningValue = []
    selectFromWhereValue = []
    deleteWasCalled = false
    updateWasCalled = false

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
      const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      // Mock insert returning the deletion request
      insertReturningValue = [
        {
          id: "deletion-request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "mock-token-abc123def456789012345678901234567890",
          scheduledDeletionAt: scheduledDate,
          createdAt: new Date(),
        },
      ]

      // Mock select returning the user
      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
          name: "Test User",
        },
      ]

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

      insertReturningValue = [
        {
          id: "deletion-request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "mock-token-abc123def456789012345678901234567890",
          scheduledDeletionAt: new Date(),
          createdAt: new Date(),
        },
      ]

      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
          name: "Test User",
        },
      ]

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await initiateAccountDeletion(userId)

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: expect.stringContaining("Confirm"),
        }),
      )
    })

    it("should throw error when user not found", async () => {
      const userId = "nonexistent-user"

      insertReturningValue = [
        {
          id: "deletion-request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "mock-token",
          scheduledDeletionAt: new Date(),
        },
      ]

      selectFromWhereValue = [] // No user found

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(initiateAccountDeletion(userId)).rejects.toThrow(
        "User not found",
      )
    })
  })

  describe("confirmAccountDeletion", () => {
    it("should confirm deletion with valid token", async () => {
      const token = "valid-token-123"
      const mockRequest = {
        id: "request-123",
        userId: "user-123",
        status: "pending",
        confirmationToken: token,
        scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }

      selectFromWhereValue = [mockRequest]
      insertReturningValue = [
        { ...mockRequest, status: DeletionRequestStatus.CONFIRMED },
      ]

      const { confirmAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await confirmAccountDeletion(token)

      expect(result.status).toBe(DeletionRequestStatus.CONFIRMED)
    })

    it("should reject invalid confirmation token", async () => {
      const token = "invalid-token"

      selectFromWhereValue = [] // No request found

      const { confirmAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(confirmAccountDeletion(token)).rejects.toThrow("Invalid")
    })

    it("should reject already processed deletion", async () => {
      const token = "valid-token-123"

      selectFromWhereValue = [
        {
          id: "request-123",
          userId: "user-123",
          status: "confirmed", // Already confirmed
          confirmationToken: token,
        },
      ]

      const { confirmAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(confirmAccountDeletion(token)).rejects.toThrow("processed")
    })
  })

  describe("cancelAccountDeletion", () => {
    it("should allow user to cancel their own pending deletion", async () => {
      const userId = "user-123"
      const requestId = "request-123"

      selectFromWhereValue = [
        {
          id: requestId,
          userId,
          status: "confirmed",
        },
      ]

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await cancelAccountDeletion(requestId, userId)

      expect(updateWasCalled).toBe(true)
    })

    it("should throw error when request not found", async () => {
      selectFromWhereValue = [] // No request found

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(
        cancelAccountDeletion("nonexistent-request", "user-123"),
      ).rejects.toThrow("not found")
    })

    it("should not allow cancellation of completed deletion", async () => {
      const userId = "user-123"
      const requestId = "request-123"

      selectFromWhereValue = [
        {
          id: requestId,
          userId,
          status: "completed",
        },
      ]

      const { cancelAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(cancelAccountDeletion(requestId, userId)).rejects.toThrow(
        "Cannot cancel",
      )
    })
  })

  describe("executeAccountDeletion", () => {
    it("should delete user data", async () => {
      const userId = "user-123"
      const userEmail = "test@example.com"

      selectFromWhereValue = [
        {
          id: userId,
          email: userEmail,
          name: "Test User",
        },
      ]

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      await executeAccountDeletion(userId)

      expect(deleteWasCalled).toBe(true)
    })

    it("should throw error when user not found", async () => {
      selectFromWhereValue = [] // No user found

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await expect(executeAccountDeletion("nonexistent")).rejects.toThrow(
        "User not found",
      )
    })

    it("should send deletion confirmation email", async () => {
      const userId = "user-123"
      const userEmail = "test@example.com"

      selectFromWhereValue = [
        {
          id: userId,
          email: userEmail,
          name: "Test User",
        },
      ]

      const { executeAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )

      await executeAccountDeletion(userId)

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userEmail,
          subject: expect.stringContaining("Deleted"),
        }),
      )
    })
  })

  describe("getPendingDeletions", () => {
    it("should return confirmed deletions past grace period", async () => {
      const pastDate = new Date(Date.now() - 1000)
      const pendingDeletions = [
        {
          id: "deletion-1",
          userId: "user-1",
          status: DeletionRequestStatus.CONFIRMED,
          scheduledDeletionAt: pastDate,
        },
      ]

      selectFromWhereValue = pendingDeletions

      const { getPendingDeletions } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await getPendingDeletions()

      expect(result.length).toBe(1)
      expect(result[0].id).toBe("deletion-1")
    })
  })

  describe("GDPR Compliance", () => {
    it("should enforce 30-day grace period (GDPR Article 17)", async () => {
      const userId = "user-123"
      const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      insertReturningValue = [
        {
          id: "request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          scheduledDeletionAt: scheduledDate,
          confirmationToken: "mock-token-abc123def456789012345678901234567890",
        },
      ]

      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
        },
      ]

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

    it("should require explicit confirmation before deletion", async () => {
      const userId = "user-123"

      insertReturningValue = [
        {
          id: "request-123",
          userId,
          status: DeletionRequestStatus.PENDING,
          confirmationToken: "mock-token-abc123def456789012345678901234567890",
          scheduledDeletionAt: new Date(),
        },
      ]

      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
        },
      ]

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await initiateAccountDeletion(userId)

      // Should start as PENDING, not CONFIRMED
      expect(result.status).toBe(DeletionRequestStatus.PENDING)
      expect(result.confirmationToken).toBeDefined()
    })

    it("should use secure tokens for confirmation", async () => {
      const userId = "user-123"

      insertReturningValue = [
        {
          id: "request-123",
          userId,
          confirmationToken: "mock-token-abc123def456789012345678901234567890",
          status: DeletionRequestStatus.PENDING,
          scheduledDeletionAt: new Date(),
        },
      ]

      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
        },
      ]

      const { initiateAccountDeletion } = await import(
        "@/lib/gdpr/deletion-service"
      )
      const result = await initiateAccountDeletion(userId)

      // Token should be sufficiently long
      expect(result.confirmationToken.length).toBeGreaterThan(20)
    })
  })
})
