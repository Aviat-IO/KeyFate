import { describe, it, expect } from "vitest"
import { sanitizeError } from "@/lib/cron/utils"

describe("sanitizeError", () => {
  it("should redact server_share field", () => {
    const error = new Error('{"server_share": "sensitive-data-here"}')
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized).not.toContain("sensitive-data-here")
  })

  it("should redact serverShare field", () => {
    const error = new Error('{"serverShare": "sensitive-data-here"}')
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized).not.toContain("sensitive-data-here")
  })

  it("should redact iv field", () => {
    const error = new Error('{"iv": "base64-iv-data"}')
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized).not.toContain("base64-iv-data")
  })

  it("should redact authTag field", () => {
    const error = new Error('{"authTag": "base64-auth-tag"}')
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized).not.toContain("base64-auth-tag")
  })

  it("should redact auth_tag field", () => {
    const error = new Error('{"auth_tag": "base64-auth-tag"}')
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized).not.toContain("base64-auth-tag")
  })

  it("should redact decrypted content field", () => {
    const error = new Error('{"decrypted": "secret-content"}')
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized).not.toContain("secret-content")
  })

  it("should redact long base64 strings", () => {
    const longBase64 = "A".repeat(60)
    const error = new Error(`Data: ${longBase64}`)
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain("[REDACTED_BASE64]")
    expect(sanitized).not.toContain(longBase64)
  })

  it("should preserve short base64-like strings", () => {
    const shortBase64 = "ABC123"
    const error = new Error(`Data: ${shortBase64}`)
    const sanitized = sanitizeError(error)
    expect(sanitized).toContain(shortBase64)
  })

  it("should include secret ID when provided", () => {
    const error = new Error("Some error")
    const sanitized = sanitizeError(error, "secret-123")
    expect(sanitized).toContain("Secret secret-123")
    expect(sanitized).toContain("Some error")
  })

  it("should handle non-Error objects", () => {
    const sanitized = sanitizeError("Plain string error")
    expect(sanitized).toBe("Plain string error")
  })

  it("should redact multiple sensitive fields in one message", () => {
    const error = new Error(
      '{"server_share": "share1", "iv": "iv1", "authTag": "tag1"}',
    )
    const sanitized = sanitizeError(error)
    expect(sanitized).not.toContain("share1")
    expect(sanitized).not.toContain("iv1")
    expect(sanitized).not.toContain("tag1")
    expect(sanitized.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
