/**
 * Tests for encryption utilities
 *
 * Ported from frontend/__tests__/lib/encryption.test.ts
 *
 * The original test only tested mocks (anti-pattern: testing mock behavior
 * instead of real behavior). This version tests the actual encryption module.
 *
 * The encryption module uses $lib/server-env which imports $env/dynamic/private.
 * We mock $env/dynamic/private in setup.ts, but the ENCRYPTION_KEY in setup
 * has insufficient entropy for the real validation. We mock server-env directly
 * to provide a proper 32-byte key.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import crypto from "crypto"

// Generate a proper 32-byte key with sufficient entropy for tests
const TEST_KEY = crypto.randomBytes(32)
const TEST_KEY_BASE64 = TEST_KEY.toString("base64")

// Mock server-env to provide a valid encryption key
vi.mock("$lib/server-env", () => ({
  serverEnv: {
    ENCRYPTION_KEY: TEST_KEY_BASE64,
  },
}))

// Set the env var too since encryption.ts also checks process.env
vi.stubEnv("ENCRYPTION_KEY", TEST_KEY_BASE64)

describe("Encryption Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("encryptMessage", () => {
    it("should encrypt a message and return encrypted data with IV and auth tag", async () => {
      const { encryptMessage } = await import("$lib/encryption")
      const testMessage = "Hello, World!"

      const result = await encryptMessage(testMessage)

      expect(result.encrypted).toBeDefined()
      expect(result.iv).toBeDefined()
      expect(result.authTag).toBeDefined()
      expect(result.keyVersion).toBe(1)

      // Verify they are base64 strings
      expect(() => Buffer.from(result.encrypted, "base64")).not.toThrow()
      expect(() => Buffer.from(result.iv, "base64")).not.toThrow()
      expect(() => Buffer.from(result.authTag, "base64")).not.toThrow()
    })

    it("should accept a custom IV", async () => {
      const { encryptMessage } = await import("$lib/encryption")
      const testMessage = "Test message"
      const customIV = crypto.randomBytes(12)

      const result = await encryptMessage(testMessage, customIV)

      expect(result.iv).toBe(customIV.toString("base64"))
    })

    it("should produce different ciphertext for same message with different IVs", async () => {
      const { encryptMessage } = await import("$lib/encryption")
      const testMessage = "Same message"

      const result1 = await encryptMessage(testMessage)
      const result2 = await encryptMessage(testMessage)

      // Different IVs should produce different ciphertext
      expect(result1.iv).not.toBe(result2.iv)
      expect(result1.encrypted).not.toBe(result2.encrypted)
    })

    it("should handle empty messages", async () => {
      const { encryptMessage } = await import("$lib/encryption")
      const emptyMessage = ""

      const result = await encryptMessage(emptyMessage)

      expect(result.encrypted).toBeDefined()
      expect(result.iv).toBeDefined()
      expect(result.authTag).toBeDefined()
    })
  })

  describe("decryptMessage", () => {
    it("should decrypt a message using cipher text, IV, and auth tag", async () => {
      const { encryptMessage, decryptMessage } = await import(
        "$lib/encryption"
      )
      const originalMessage = "Decrypted message"

      const encrypted = await encryptMessage(originalMessage)
      const ivBuffer = Buffer.from(encrypted.iv, "base64")
      const authTagBuffer = Buffer.from(encrypted.authTag, "base64")

      const result = await decryptMessage(
        encrypted.encrypted,
        ivBuffer,
        authTagBuffer,
      )

      expect(result).toBe(originalMessage)
    })

    it("should handle decryption errors gracefully", async () => {
      const { decryptMessage } = await import("$lib/encryption")
      const invalidCipherText = "invalid-cipher"
      const ivBuffer = crypto.randomBytes(12)
      const authTag = crypto.randomBytes(16)

      await expect(
        decryptMessage(invalidCipherText, ivBuffer, authTag),
      ).rejects.toThrow()
    })
  })

  describe("Encryption/Decryption Round Trip", () => {
    it("should successfully encrypt and decrypt a message", async () => {
      const { encryptMessage, decryptMessage } = await import(
        "$lib/encryption"
      )
      const originalMessage = "This is a secret message!"

      const encrypted = await encryptMessage(originalMessage)

      const ivBuffer = Buffer.from(encrypted.iv, "base64")
      const authTagBuffer = Buffer.from(encrypted.authTag, "base64")
      const decrypted = await decryptMessage(
        encrypted.encrypted,
        ivBuffer,
        authTagBuffer,
      )

      expect(decrypted).toBe(originalMessage)
    })

    it("should handle unicode messages", async () => {
      const { encryptMessage, decryptMessage } = await import(
        "$lib/encryption"
      )
      const unicodeMessage = "Hello! Emoji: \u{1F512}\u{1F511} CJK: \u4F60\u597D"

      const encrypted = await encryptMessage(unicodeMessage)
      const ivBuffer = Buffer.from(encrypted.iv, "base64")
      const authTagBuffer = Buffer.from(encrypted.authTag, "base64")
      const decrypted = await decryptMessage(
        encrypted.encrypted,
        ivBuffer,
        authTagBuffer,
      )

      expect(decrypted).toBe(unicodeMessage)
    })

    it("should handle long messages", async () => {
      const { encryptMessage, decryptMessage } = await import(
        "$lib/encryption"
      )
      const longMessage = "A".repeat(10000)

      const encrypted = await encryptMessage(longMessage)
      const ivBuffer = Buffer.from(encrypted.iv, "base64")
      const authTagBuffer = Buffer.from(encrypted.authTag, "base64")
      const decrypted = await decryptMessage(
        encrypted.encrypted,
        ivBuffer,
        authTagBuffer,
      )

      expect(decrypted).toBe(longMessage)
    })
  })
})
