import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ExportJobStatus } from "@/lib/db/schema"

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
  returning: vi.fn().mockResolvedValue([]),
}))

const mockGetDatabase = vi.hoisted(() => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
}))

const mockStorage = vi.hoisted(() => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn(),
        getSignedUrl: vi.fn(() =>
          Promise.resolve([
            "https://storage.googleapis.com/bucket/file?signature=xyz",
          ]),
        ),
        delete: vi.fn(),
      })),
      getFiles: vi.fn(() => Promise.resolve([[]])),
    })),
  })),
}))

const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn(() => Promise.resolve({ messageId: "test-message-id" })),
}))

// Apply mocks
vi.mock("@/lib/db/get-database", () => mockGetDatabase)
vi.mock("@google-cloud/storage", () => mockStorage)
vi.mock("@/lib/email/email-service", () => mockEmailService)

const originalEnv = process.env

describe("GDPR Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      EXPORT_BUCKET: "test-export-bucket",
    }

    // Reset mock implementations
    mockDb.returning.mockResolvedValue([])
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("createExportJob", () => {
    it("should create a new export job for a user", async () => {
      const userId = "test-user-123"
      const mockJob = {
        id: "job-123",
        userId,
        status: ExportJobStatus.PENDING,
        createdAt: new Date(),
      }

      mockDb.returning.mockResolvedValueOnce([mockJob])

      const { createExportJob } = await import("@/lib/gdpr/export-service")
      const result = await createExportJob(userId)

      expect(result).toEqual(mockJob)
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalled()
    })

    it("should reject if user has a recent export job (within 24 hours)", async () => {
      const userId = "test-user-123"
      const recentJob = {
        id: "recent-job",
        userId,
        status: ExportJobStatus.COMPLETED,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      }

      mockDb.limit.mockResolvedValueOnce([recentJob])

      const { createExportJob } = await import("@/lib/gdpr/export-service")

      await expect(createExportJob(userId)).rejects.toThrow("already requested")
    })

    it("should allow export if previous job was over 24 hours ago", async () => {
      const userId = "test-user-123"
      const oldJob = {
        id: "old-job",
        userId,
        status: ExportJobStatus.COMPLETED,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      }

      mockDb.limit.mockResolvedValueOnce([oldJob])
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "new-job",
          userId,
          status: ExportJobStatus.PENDING,
          createdAt: new Date(),
        },
      ])

      const { createExportJob } = await import("@/lib/gdpr/export-service")
      const result = await createExportJob(userId)

      expect(result).toBeDefined()
      expect(result.id).toBe("new-job")
    })
  })

  describe("getUserData", () => {
    it("should compile complete user data export", async () => {
      const userId = "test-user-123"
      const mockUserData = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
      }

      mockDb.limit.mockResolvedValueOnce([mockUserData])
      mockDb.where.mockResolvedValue([]) // Empty arrays for secrets, check-ins, etc.

      const { getUserData } = await import("@/lib/gdpr/export-service")
      const result = await getUserData(userId)

      expect(result.user.id).toBe(userId)
      expect(result.user.email).toBe("test@example.com")
      expect(result.secrets).toEqual([])
      expect(result.checkIns).toEqual([])
      expect(result.auditLogs).toEqual([])
    })

    it("should include all user secrets with recipients", async () => {
      const userId = "test-user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
          name: "Test User",
          createdAt: new Date(),
        },
      ])

      const mockSecrets = [
        {
          id: "secret-1",
          userId,
          title: "Test Secret",
          serverShare: "encrypted-data",
          checkInDays: 30,
          status: "active",
          createdAt: new Date(),
          lastCheckIn: new Date(),
          nextCheckIn: new Date(),
        },
      ]

      mockDb.where.mockResolvedValueOnce(mockSecrets)

      const mockRecipients = [
        { name: "Recipient 1", email: "r1@example.com", phone: null },
      ]

      // Mock recipient query
      mockDb.where.mockResolvedValueOnce(mockRecipients)
      mockDb.where.mockResolvedValue([]) // Empty for other queries

      const { getUserData } = await import("@/lib/gdpr/export-service")
      const result = await getUserData(userId)

      expect(result.secrets.length).toBe(1)
      expect(result.secrets[0].recipients.length).toBe(1)
      expect(result.secrets[0].recipients[0].name).toBe("Recipient 1")
    })
  })

  describe("uploadExportFile", () => {
    it("should upload export to Cloud Storage and return signed URL", async () => {
      const userId = "test-user-123"
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: userId,
          email: "test@example.com",
          name: "Test User",
          emailVerified: null,
          createdAt: new Date(),
        },
        secrets: [],
        checkIns: [],
        auditLogs: [],
        subscription: null,
        paymentHistory: [],
      }

      const { uploadExportFile } = await import("@/lib/gdpr/export-service")
      const result = await uploadExportFile(userId, exportData)

      expect(result).toContain("storage.googleapis.com")
      expect(result).toContain("signature=")
    })
  })

  describe("trackDownload", () => {
    it("should increment download count", async () => {
      const jobId = "job-123"
      mockDb.limit.mockResolvedValueOnce([
        {
          id: jobId,
          userId: "user-123",
          downloadCount: 1,
          maxDownloads: 3,
        },
      ])

      const { trackDownload } = await import("@/lib/gdpr/export-service")
      await trackDownload(jobId)

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ downloadCount: 2 }),
      )
    })

    it("should reject download if max downloads reached", async () => {
      const jobId = "job-123"
      mockDb.limit.mockResolvedValueOnce([
        {
          id: jobId,
          userId: "user-123",
          downloadCount: 3,
          maxDownloads: 3,
        },
      ])

      const { trackDownload } = await import("@/lib/gdpr/export-service")

      await expect(trackDownload(jobId)).rejects.toThrow(
        "Maximum download limit reached",
      )
    })
  })

  describe("getExpiredExports", () => {
    it("should return exports older than 24 hours", async () => {
      const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000)
      const expiredJobs = [
        {
          id: "expired-job-1",
          userId: "user-1",
          status: ExportJobStatus.COMPLETED,
          createdAt: expiredDate,
        },
      ]

      mockDb.where.mockResolvedValueOnce(expiredJobs)

      const { getExpiredExports } = await import("@/lib/gdpr/export-service")
      const result = await getExpiredExports()

      expect(result.length).toBe(1)
      expect(result[0].id).toBe("expired-job-1")
    })
  })

  describe("Security & Rate Limiting", () => {
    it("should prevent multiple concurrent export requests", async () => {
      const userId = "test-user-123"

      mockDb.limit.mockResolvedValue([
        {
          id: "pending-job",
          userId,
          status: ExportJobStatus.PENDING,
          createdAt: new Date(),
        },
      ])

      const { createExportJob } = await import("@/lib/gdpr/export-service")

      await expect(createExportJob(userId)).rejects.toThrow()
    })

    it("should enforce 24-hour rate limit between exports", async () => {
      const userId = "test-user-123"
      const recentExport = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago

      mockDb.limit.mockResolvedValue([
        {
          id: "recent-job",
          userId,
          status: ExportJobStatus.COMPLETED,
          createdAt: recentExport,
        },
      ])

      const { createExportJob } = await import("@/lib/gdpr/export-service")

      await expect(createExportJob(userId)).rejects.toThrow("already requested")
    })
  })

  describe("Data Completeness", () => {
    it("should include all GDPR-required data fields", async () => {
      const userId = "test-user-123"

      mockDb.limit.mockResolvedValueOnce([
        {
          id: userId,
          email: "test@example.com",
          name: "Test User",
          createdAt: new Date(),
        },
      ])

      mockDb.where.mockResolvedValue([])

      const { getUserData } = await import("@/lib/gdpr/export-service")
      const result = await getUserData(userId)

      // GDPR Article 15 requires complete personal data
      expect(result).toHaveProperty("user")
      expect(result).toHaveProperty("secrets")
      expect(result).toHaveProperty("checkIns")
      expect(result).toHaveProperty("auditLogs")
      expect(result).toHaveProperty("subscription")
      expect(result).toHaveProperty("paymentHistory")
      expect(result).toHaveProperty("exportedAt")
    })
  })
})
