/**
 * Tests for logger sanitization
 *
 * Ported from frontend/__tests__/lib/logger.test.ts
 * The logger imports $lib/request-context which is mocked in setup.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { logger, withRequestId } from "$lib/logger"

describe("Logger Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe("Sensitive Data Redaction", () => {
    it("should redact serverShare field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { serverShare: "sensitive-data" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.serverShare).toBe("[REDACTED]")
    })

    it("should redact encryptedShare field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { encryptedShare: "sensitive-data" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.encryptedShare).toBe("[REDACTED]")
    })

    it("should redact secret field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { secret: "sensitive-data" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.secret).toBe("[REDACTED]")
    })

    it("should redact token field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { token: "sensitive-token" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.token).toBe("[REDACTED]")
    })

    it("should redact password field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { password: "sensitive-password" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.password).toBe("[REDACTED]")
    })

    it("should redact key field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { key: "sensitive-key" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.key).toBe("[REDACTED]")
    })

    it("should redact otp field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { otp: "123456" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.otp).toBe("[REDACTED]")
    })

    it("should redact apiKey field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { apiKey: "sensitive-api-key" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.apiKey).toBe("[REDACTED]")
    })

    it("should redact accessToken field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { accessToken: "sensitive-token" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.accessToken).toBe("[REDACTED]")
    })

    it("should redact privateKey field", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", { privateKey: "sensitive-key" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.privateKey).toBe("[REDACTED]")
    })
  })

  describe("Nested Object Sanitization", () => {
    it("should redact sensitive fields in nested objects", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", {
        user: {
          id: "123",
          password: "secret123",
          email: "test@example.com",
        },
      })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.user.id).toBe("123")
      expect(logOutput.data.user.password).toBe("[REDACTED]")
      // Email is partially masked for privacy
      expect(logOutput.data.user.email).toBe("t***@example.com")
    })

    it("should redact sensitive fields in arrays", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", {
        items: [
          { id: "1", secret: "secret1" },
          { id: "2", secret: "secret2" },
        ],
      })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.items[0].id).toBe("1")
      expect(logOutput.data.items[0].secret).toBe("[REDACTED]")
      expect(logOutput.data.items[1].id).toBe("2")
      expect(logOutput.data.items[1].secret).toBe("[REDACTED]")
    })

    it("should handle deeply nested sensitive data", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", {
        level1: {
          level2: {
            level3: {
              apiKey: "sensitive",
              publicInfo: "safe",
            },
          },
        },
      })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.level1.level2.level3.apiKey).toBe("[REDACTED]")
      expect(logOutput.data.level1.level2.level3.publicInfo).toBe("safe")
    })
  })

  describe("Non-Sensitive Data Preservation", () => {
    it("should preserve non-sensitive data", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", {
        userId: "123",
        email: "test@example.com",
        status: "active",
      })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.userId).toBe("123")
      // Email is partially masked for privacy
      expect(logOutput.data.email).toBe("t***@example.com")
      expect(logOutput.data.status).toBe("active")
    })

    it("should preserve null and undefined values", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", {
        nullValue: null,
        undefinedValue: undefined,
      })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.nullValue).toBeNull()
      expect(logOutput.data.undefinedValue).toBeUndefined()
    })
  })

  describe("Log Levels", () => {
    it("should log info messages with correct level", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Info message", { data: "test" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.level).toBe("info")
      expect(logOutput.message).toBe("Info message")
    })

    it("should log warn messages with correct level", () => {
      const consoleSpy = vi.spyOn(console, "warn")
      logger.warn("Warning message", { data: "test" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.level).toBe("warn")
      expect(logOutput.message).toBe("Warning message")
    })

    it("should log error messages with error details", () => {
      const consoleSpy = vi.spyOn(console, "error")
      const testError = new Error("Test error")
      logger.error("Error message", testError, { context: "test" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.level).toBe("error")
      expect(logOutput.message).toBe("Error message")
      expect(logOutput.error).toBe("Test error")
      expect(logOutput.data.context).toBe("test")
    })

    it("should include timestamp in all logs", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message")

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.timestamp).toBeDefined()
      expect(new Date(logOutput.timestamp).toString()).not.toBe("Invalid Date")
    })
  })

  describe("Case Insensitivity", () => {
    it("should redact fields with different casing", () => {
      const consoleSpy = vi.spyOn(console, "log")
      logger.info("Test message", {
        ServerShare: "sensitive",
        SERVERCONNECTION: "sensitive",
        serverPassword: "sensitive",
      })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.ServerShare).toBe("[REDACTED]")
      expect(logOutput.data.SERVERCONNECTION).toBe("sensitive")
      expect(logOutput.data.serverPassword).toBe("[REDACTED]")
    })
  })

  describe("Request ID Support", () => {
    it("should support withRequestId helper", () => {
      const consoleSpy = vi.spyOn(console, "log")

      const requestLogger = withRequestId("req-123")
      requestLogger.info("Test message", { data: "test" })

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(logOutput.data.requestId).toBe("req-123")
      expect(logOutput.data.data).toBe("test")
    })
  })
})
