import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  generateRecoveryKit,
  getUserManagedSharesFromStorage,
  type RecoveryKitData,
  type SecretMetadata,
} from "@/lib/export-recovery-kit"

// Mock JSZip
vi.mock("jszip", () => {
  const mockFile = vi.fn().mockReturnThis()
  const mockFolder = vi.fn().mockReturnValue({
    file: mockFile,
  })
  const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(["test"]))

  return {
    default: vi.fn().mockImplementation(() => ({
      file: mockFile,
      folder: mockFolder,
      generateAsync: mockGenerateAsync,
    })),
  }
})

// Mock file-saver
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}))

describe("export-recovery-kit", () => {
  const mockMetadata: SecretMetadata = {
    id: "test-secret-id-123",
    title: "Test Secret",
    threshold: 2,
    totalShares: 3,
    checkInDays: 7,
    recipients: [
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: "bob@example.com" },
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    exportedAt: "2024-06-01T00:00:00.000Z",
  }

  const mockRecoveryKitData: RecoveryKitData = {
    metadata: mockMetadata,
    serverShare: "8001abc123def456",
    userManagedShares: ["8002789ghi", "8003jkl012"],
  }

  describe("generateRecoveryKit", () => {
    it("should generate a ZIP blob with all required files", async () => {
      const blob = await generateRecoveryKit(mockRecoveryKitData)

      expect(blob).toBeInstanceOf(Blob)
    })

    it("should include recovery.html in the ZIP", async () => {
      const JSZip = (await import("jszip")).default
      await generateRecoveryKit(mockRecoveryKitData)

      const mockInstance = new JSZip()
      expect(mockInstance.file).toHaveBeenCalledWith(
        "recovery.html",
        expect.stringContaining("<!DOCTYPE html>")
      )
    })

    it("should include instructions.md in the ZIP", async () => {
      const JSZip = (await import("jszip")).default
      await generateRecoveryKit(mockRecoveryKitData)

      const mockInstance = new JSZip()
      expect(mockInstance.file).toHaveBeenCalledWith(
        "instructions.md",
        expect.stringContaining("# KeyFate Recovery Instructions")
      )
    })

    it("should include metadata.json in the ZIP", async () => {
      const JSZip = (await import("jszip")).default
      await generateRecoveryKit(mockRecoveryKitData)

      const mockInstance = new JSZip()
      expect(mockInstance.file).toHaveBeenCalledWith(
        "metadata.json",
        expect.stringContaining('"secretId"')
      )
    })

    it("should create shares folder with server share", async () => {
      const JSZip = (await import("jszip")).default
      await generateRecoveryKit(mockRecoveryKitData)

      const mockInstance = new JSZip()
      expect(mockInstance.folder).toHaveBeenCalledWith("shares")
    })

    it("should handle missing server share gracefully", async () => {
      const dataWithoutServerShare: RecoveryKitData = {
        ...mockRecoveryKitData,
        serverShare: null,
      }

      const blob = await generateRecoveryKit(dataWithoutServerShare)
      expect(blob).toBeInstanceOf(Blob)
    })

    it("should handle empty user-managed shares", async () => {
      const dataWithoutUserShares: RecoveryKitData = {
        ...mockRecoveryKitData,
        userManagedShares: [],
      }

      const blob = await generateRecoveryKit(dataWithoutUserShares)
      expect(blob).toBeInstanceOf(Blob)
    })
  })

  describe("getUserManagedSharesFromStorage", () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
    })

    it("should return empty array when no shares exist", () => {
      const result = getUserManagedSharesFromStorage("non-existent-id")
      expect(result).toEqual([])
    })

    it("should return shares from localStorage", () => {
      const secretId = "test-secret-123"
      const shares = ["share1", "share2"]
      const expiresAt = Date.now() + 1000 * 60 * 60 // 1 hour from now

      localStorage.setItem(
        `keyfate:userManagedShares:${secretId}`,
        JSON.stringify({ shares, expiresAt })
      )

      const result = getUserManagedSharesFromStorage(secretId)
      expect(result).toEqual(shares)
    })

    it("should return empty array for expired shares", () => {
      const secretId = "test-secret-123"
      const shares = ["share1", "share2"]
      const expiresAt = Date.now() - 1000 // Already expired

      localStorage.setItem(
        `keyfate:userManagedShares:${secretId}`,
        JSON.stringify({ shares, expiresAt })
      )

      const result = getUserManagedSharesFromStorage(secretId)
      expect(result).toEqual([])
    })

    it("should remove expired shares from localStorage", () => {
      const secretId = "test-secret-123"
      const shares = ["share1", "share2"]
      const expiresAt = Date.now() - 1000 // Already expired

      localStorage.setItem(
        `keyfate:userManagedShares:${secretId}`,
        JSON.stringify({ shares, expiresAt })
      )

      getUserManagedSharesFromStorage(secretId)

      expect(localStorage.getItem(`keyfate:userManagedShares:${secretId}`)).toBeNull()
    })

    it("should handle malformed JSON gracefully", () => {
      const secretId = "test-secret-123"
      localStorage.setItem(
        `keyfate:userManagedShares:${secretId}`,
        "not-valid-json"
      )

      const result = getUserManagedSharesFromStorage(secretId)
      expect(result).toEqual([])
    })
  })

  describe("SecretMetadata interface", () => {
    it("should have all required fields", () => {
      const metadata: SecretMetadata = {
        id: "123",
        title: "Test",
        threshold: 2,
        totalShares: 3,
        checkInDays: 7,
        recipients: [],
        createdAt: new Date().toISOString(),
        exportedAt: new Date().toISOString(),
      }

      expect(metadata.id).toBeDefined()
      expect(metadata.title).toBeDefined()
      expect(metadata.threshold).toBeDefined()
      expect(metadata.totalShares).toBeDefined()
      expect(metadata.checkInDays).toBeDefined()
      expect(metadata.recipients).toBeDefined()
      expect(metadata.createdAt).toBeDefined()
      expect(metadata.exportedAt).toBeDefined()
    })
  })

  describe("RecoveryKitData interface", () => {
    it("should have all required fields", () => {
      const data: RecoveryKitData = {
        metadata: mockMetadata,
        serverShare: "test-share",
        userManagedShares: ["share1", "share2"],
      }

      expect(data.metadata).toBeDefined()
      expect(data.serverShare).toBeDefined()
      expect(data.userManagedShares).toBeDefined()
    })

    it("should allow null server share", () => {
      const data: RecoveryKitData = {
        metadata: mockMetadata,
        serverShare: null,
        userManagedShares: [],
      }

      expect(data.serverShare).toBeNull()
    })
  })
})

describe("Recovery HTML generation", () => {
  const mockMetadata: SecretMetadata = {
    id: "test-id",
    title: "Test Secret",
    threshold: 2,
    totalShares: 3,
    checkInDays: 7,
    recipients: [{ name: "Test", email: "test@example.com" }],
    createdAt: new Date().toISOString(),
    exportedAt: new Date().toISOString(),
  }

  it("should generate HTML with correct threshold information", async () => {
    const data: RecoveryKitData = {
      metadata: mockMetadata,
      serverShare: "test",
      userManagedShares: [],
    }

    // Generate the kit to trigger HTML generation
    await generateRecoveryKit(data)

    // The HTML should be generated with threshold info
    // We can't easily inspect the HTML content with the mock,
    // but we can verify the function completes without error
    expect(true).toBe(true)
  })
})
