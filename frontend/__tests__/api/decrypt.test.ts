import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Import setup to apply mocks
import "./setup"

// Set environment variable before importing the route
process.env.ENCRYPTION_KEY = "a".repeat(32)

import { POST } from "@/app/api/decrypt/route"
import { decryptMessage } from "@/lib/encryption"

// Mock the encryption module
vi.mocked(decryptMessage)

describe("/api/decrypt", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up environment variable
    process.env.ENCRYPTION_KEY = "a".repeat(32) // 32 character key

    // Reset crypto mocks
    const mockDecrypt = vi.fn(() => Promise.resolve(new ArrayBuffer(16)))
    const mockImportKey = vi.fn(() => Promise.resolve({}))

    Object.defineProperty(global, "crypto", {
      value: {
        subtle: {
          importKey: mockImportKey,
          decrypt: mockDecrypt,
        },
      },
    })
  })

  it("should decrypt a message successfully", async () => {
    // Mock successful decryption
    vi.mocked(decryptMessage).mockResolvedValue("decrypted message")

    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "dGVzdA==", // base64 encoded
        iv: "aXYxMjM=", // base64 encoded
      }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(data).toHaveProperty("decryptedMessage")
    expect(data.decryptedMessage).toBe("decrypted message")
  })

  it("should return 400 when encryptedMessage is missing", async () => {
    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iv: "aXYxMjM=" }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Missing encryptedMessage or iv")
  })

  it("should return 400 when iv is missing", async () => {
    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedMessage: "dGVzdA==" }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Missing encryptedMessage or iv")
  })

  it("should return 400 when both parameters are missing", async () => {
    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Missing encryptedMessage or iv")
  })

  it("should return 500 when decryption fails", async () => {
    // Mock decryption to throw an error
    vi.mocked(decryptMessage).mockRejectedValue(new Error("Decryption failed"))

    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "dGVzdA==",
        iv: "aXYxMjM=",
      }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Decryption failed")
  })

  it("should handle invalid JSON request", async () => {
    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Decryption failed")
  })

  it("should use correct decryption parameters", async () => {
    vi.mocked(decryptMessage).mockResolvedValue("decrypted message")

    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "dGVzdA==",
        iv: "aXYxMjM=",
      }),
    })

    await POST(mockRequest)

    // Verify decryptMessage was called with correct parameters
    expect(decryptMessage).toHaveBeenCalledWith(
      "dGVzdA==",
      expect.any(Buffer),
      expect.any(Buffer),
    )
  })

  it("should handle invalid base64 input gracefully", async () => {
    // Mock Buffer.from to throw an error for invalid base64
    const originalBufferFrom = Buffer.from
    ;(Buffer.from as any) = vi.fn((str: any, encoding?: any) => {
      if (str.includes("!@#")) {
        throw new Error("Invalid base64")
      }
      return originalBufferFrom(str, encoding)
    })

    const mockRequest = new NextRequest("http://localhost/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedMessage: "invalid-base64!@#",
        iv: "invalid-base64!@#",
      }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Decryption failed")

    // Restore original Buffer.from
    Buffer.from = originalBufferFrom
  })
})
