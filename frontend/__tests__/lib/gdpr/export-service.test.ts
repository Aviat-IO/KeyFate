import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ExportJobStatus } from "@/lib/db/schema"

// Track mock state
let selectFromWhereValue: unknown[] = []
let insertReturningValue: unknown[] = []
let updateWasCalled = false

const mockGetDatabase = vi.hoisted(() => {
  return {
    getDatabase: vi.fn(async () => {
      // Create a chainable mock that returns arrays
      const createChain = (value: unknown) => {
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
        select: vi.fn(() => createChain(selectFromWhereValue)),
        update: vi.fn(() => {
          updateWasCalled = true
          return {
            set: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve([])),
            })),
          }
        }),
      }
    }),
  }
})

const mockStorage = vi.hoisted(() => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn(() => Promise.resolve()),
        getSignedUrl: vi.fn(() =>
          Promise.resolve([
            "https://storage.googleapis.com/bucket/file?signature=xyz",
          ]),
        ),
        delete: vi.fn(() => Promise.resolve()),
      })),
      getFiles: vi.fn(() => Promise.resolve([[]])),
    })),
  })),
}))

// Apply mocks
vi.mock("@/lib/db/get-database", () => mockGetDatabase)
vi.mock("@google-cloud/storage", () => mockStorage)

const originalEnv = process.env

describe("GDPR Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      EXPORT_BUCKET: "test-export-bucket",
    }

    // Reset tracking variables
    selectFromWhereValue = []
    insertReturningValue = []
    updateWasCalled = false
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("generateUserDataExport", () => {
    it("should compile complete user data export", async () => {
      const userId = "test-user-123"
      const mockUserData = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
      }

      selectFromWhereValue = [mockUserData]

      const { generateUserDataExport } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await generateUserDataExport(userId)

      expect(result.user.id).toBe(userId)
      expect(result.user.email).toBe("test@example.com")
      expect(result.exportedAt).toBeDefined()
    })

    it("should throw error when user not found", async () => {
      selectFromWhereValue = [] // No user found

      const { generateUserDataExport } = await import(
        "@/lib/gdpr/export-service"
      )

      await expect(generateUserDataExport("nonexistent")).rejects.toThrow(
        "User not found",
      )
    })

    it("should include all GDPR-required data fields", async () => {
      const userId = "test-user-123"

      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
          name: "Test User",
          emailVerified: null,
          createdAt: new Date(),
        },
      ]

      const { generateUserDataExport } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await generateUserDataExport(userId)

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

      expect(result.fileUrl).toContain("storage.googleapis.com")
      expect(result.fileUrl).toContain("signature=")
      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe("recordExportJob", () => {
    it("should create a completed export job record", async () => {
      const userId = "test-user-123"
      const fileUrl = "https://storage.googleapis.com/bucket/file"
      const fileSize = 1024

      insertReturningValue = [
        {
          id: "job-123",
          userId,
          status: ExportJobStatus.COMPLETED,
          fileUrl,
          fileSize,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ]

      const { recordExportJob } = await import("@/lib/gdpr/export-service")
      const result = await recordExportJob(userId, fileUrl, fileSize)

      expect(result.id).toBe("job-123")
      expect(result.status).toBe(ExportJobStatus.COMPLETED)
      expect(result.fileUrl).toBe(fileUrl)
    })
  })

  describe("hasRecentExportRequest", () => {
    it("should return true if user has export within 24 hours", async () => {
      const userId = "test-user-123"
      const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago

      selectFromWhereValue = [
        {
          id: "recent-job",
          userId,
          status: ExportJobStatus.COMPLETED,
          createdAt: recentDate,
        },
      ]

      const { hasRecentExportRequest } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await hasRecentExportRequest(userId)

      expect(result).toBe(true)
    })

    it("should return false if no recent export", async () => {
      selectFromWhereValue = [] // No recent job

      const { hasRecentExportRequest } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await hasRecentExportRequest("user-123")

      expect(result).toBe(false)
    })

    it("should return false if export is older than 24 hours", async () => {
      const userId = "test-user-123"
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago

      selectFromWhereValue = [
        {
          id: "old-job",
          userId,
          status: ExportJobStatus.COMPLETED,
          createdAt: oldDate,
        },
      ]

      const { hasRecentExportRequest } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await hasRecentExportRequest(userId)

      expect(result).toBe(false)
    })
  })

  describe("createPendingExportJob", () => {
    it("should create a pending export job", async () => {
      const userId = "test-user-123"

      insertReturningValue = [
        {
          id: "pending-job-123",
          userId,
          status: ExportJobStatus.PENDING,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      ]

      const { createPendingExportJob } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await createPendingExportJob(userId)

      expect(result.id).toBe("pending-job-123")
      expect(result.status).toBe(ExportJobStatus.PENDING)
    })
  })

  describe("getExportJob", () => {
    it("should return export job by ID", async () => {
      const jobId = "job-123"

      selectFromWhereValue = [
        {
          id: jobId,
          userId: "user-123",
          status: ExportJobStatus.COMPLETED,
          fileUrl: "https://example.com/file",
        },
      ]

      const { getExportJob } = await import("@/lib/gdpr/export-service")
      const result = await getExportJob(jobId)

      expect(result.id).toBe(jobId)
    })

    it("should return undefined when job not found", async () => {
      selectFromWhereValue = [] // No job found

      const { getExportJob } = await import("@/lib/gdpr/export-service")
      const result = await getExportJob("nonexistent")

      expect(result).toBeUndefined()
    })
  })

  describe("incrementDownloadCount", () => {
    it("should increment download count for job", async () => {
      const jobId = "job-123"

      selectFromWhereValue = [
        {
          id: jobId,
          userId: "user-123",
          downloadCount: 1,
        },
      ]

      const { incrementDownloadCount } = await import(
        "@/lib/gdpr/export-service"
      )
      await incrementDownloadCount(jobId)

      expect(updateWasCalled).toBe(true)
    })

    it("should throw error when job not found", async () => {
      selectFromWhereValue = [] // No job found

      const { incrementDownloadCount } = await import(
        "@/lib/gdpr/export-service"
      )

      await expect(incrementDownloadCount("nonexistent")).rejects.toThrow(
        "not found",
      )
    })
  })

  describe("Data Export Format", () => {
    it("should export user data in portable JSON format", async () => {
      const userId = "test-user-123"

      selectFromWhereValue = [
        {
          id: userId,
          email: "test@example.com",
          name: "Test User",
          emailVerified: new Date(),
          createdAt: new Date(),
        },
      ]

      const { generateUserDataExport } = await import(
        "@/lib/gdpr/export-service"
      )
      const result = await generateUserDataExport(userId)

      // Should be JSON serializable
      expect(() => JSON.stringify(result)).not.toThrow()

      // Should have proper date format in exportedAt
      expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })
  })
})
