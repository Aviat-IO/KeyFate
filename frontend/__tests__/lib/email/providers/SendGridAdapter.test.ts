/**
 * SendGrid Email Provider Adapter Tests
 *
 * Tests for SendGrid implementation of EmailProvider interface.
 * Validates configuration, email sending, retry logic, rate limiting,
 * and error handling with exponential backoff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type {
  EmailData,
  EmailResult,
} from "@/lib/email/providers/EmailProvider"

// Mock nodemailer
const mockSendMail = vi.fn()
const mockCreateTransport = vi.fn()

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (...args: any[]) => mockCreateTransport(...args),
  },
}))

// Import after mocking
const importSendGridAdapter = async () => {
  const module = await import("@/lib/email/providers/SendGridAdapter")
  return module.SendGridAdapter
}

describe("SendGridAdapter", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    vi.clearAllMocks()
    originalEnv = { ...process.env }

    // Set up default test environment
    process.env.SENDGRID_API_KEY = "test-sendgrid-api-key"
    process.env.SENDGRID_ADMIN_EMAIL = "admin@test.com"
    process.env.SENDGRID_SENDER_NAME = "Test Service"

    // Configure mock transporter
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    })
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe("Configuration validation", () => {
    it("should validate when all required environment variables are present", async () => {
      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const isValid = await adapter.validateConfig()

      expect(isValid).toBe(true)
    })

    it("should fail validation when SENDGRID_API_KEY is missing", async () => {
      delete process.env.SENDGRID_API_KEY

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const isValid = await adapter.validateConfig()

      expect(isValid).toBe(false)
    })

    it("should fail validation when SENDGRID_ADMIN_EMAIL is missing", async () => {
      delete process.env.SENDGRID_ADMIN_EMAIL

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const isValid = await adapter.validateConfig()

      expect(isValid).toBe(false)
    })

    it("should use default sender name if SENDGRID_SENDER_NAME is missing", async () => {
      delete process.env.SENDGRID_SENDER_NAME

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const isValid = await adapter.validateConfig()

      expect(isValid).toBe(true)
    })
  })

  describe("Email sending", () => {
    const emailData: EmailData = {
      to: "user@example.com",
      subject: "Test Email",
      html: "<p>Test content</p>",
      text: "Test content",
    }

    it("should send email successfully", async () => {
      mockSendMail.mockResolvedValue({
        messageId: "sendgrid-msg-123",
        response: "250 OK",
      })

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(true)
      expect(result.messageId).toBe("sendgrid-msg-123")
      expect(result.provider).toBe("sendgrid")
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        }),
      )
    })

    it("should include optional email fields when provided", async () => {
      mockSendMail.mockResolvedValue({
        messageId: "sendgrid-msg-456",
      })

      const emailWithOptionals: EmailData = {
        ...emailData,
        from: "custom@example.com",
        replyTo: "reply@example.com",
        priority: "high",
        headers: { "X-Custom-Header": "test-value" },
      }

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      await adapter.sendEmail(emailWithOptionals)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: emailWithOptionals.from,
          replyTo: emailWithOptionals.replyTo,
          priority: emailWithOptionals.priority,
          headers: expect.objectContaining({
            "X-Custom-Header": "test-value",
          }),
        }),
      )
    })

    it("should use default sender email when from is not provided", async () => {
      mockSendMail.mockResolvedValue({
        messageId: "sendgrid-msg-789",
      })

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      await adapter.sendEmail(emailData)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining("admin@test.com"),
        }),
      )
    })
  })

  describe("Error handling", () => {
    const emailData: EmailData = {
      to: "user@example.com",
      subject: "Test Email",
      html: "<p>Test</p>",
    }

    it("should handle invalid API key errors as non-retryable", async () => {
      mockSendMail.mockRejectedValue(new Error("Invalid API key"))

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid API key")
      expect(result.retryable).toBe(false)
    })

    it("should handle authentication errors as non-retryable", async () => {
      mockSendMail.mockRejectedValue(new Error("Authentication failed"))

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Authentication failed")
      expect(result.retryable).toBe(false)
    })

    it("should handle network errors as retryable", async () => {
      mockSendMail.mockRejectedValue(new Error("Network timeout"))

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(true)
    })

    it("should handle rate limiting (429) errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded")
      ;(rateLimitError as any).statusCode = 429
      mockSendMail.mockRejectedValue(rateLimitError)

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Rate limit")
      expect(result.retryable).toBe(true)
      expect(result.retryAfter).toBeDefined()
      expect(result.rateLimitInfo).toBeDefined()
    })
  })

  describe("Retry logic with exponential backoff", () => {
    const emailData: EmailData = {
      to: "user@example.com",
      subject: "Test Email",
      html: "<p>Test</p>",
    }

    it("should retry on retryable errors with exponential backoff", async () => {
      let attemptCount = 0

      mockSendMail.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.reject(new Error("Temporary network error"))
        }
        return Promise.resolve({ messageId: "success-after-retry" })
      })

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const startTime = Date.now()
      const result = await adapter.sendEmail(emailData)
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.messageId).toBe("success-after-retry")
      expect(result.attempts).toBe(3)
      // Verify exponential backoff occurred (should take at least base delay * 2)
      expect(duration).toBeGreaterThan(1000)
    })

    it("should not retry on non-retryable errors", async () => {
      mockSendMail.mockRejectedValue(new Error("Invalid API key"))

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(mockSendMail).toHaveBeenCalledTimes(1)
    })

    it("should give up after max retries", async () => {
      mockSendMail.mockRejectedValue(new Error("Persistent network error"))

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3) // Default max retries
      expect(mockSendMail).toHaveBeenCalledTimes(3)
    })
  })

  describe("Provider metadata", () => {
    it("should return correct provider name", async () => {
      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const name = adapter.getProviderName()

      expect(name).toBe("sendgrid")
    })
  })

  describe("Configuration validation edge cases", () => {
    it("should handle empty string API key as invalid", async () => {
      process.env.SENDGRID_API_KEY = ""

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const isValid = await adapter.validateConfig()

      expect(isValid).toBe(false)
    })

    it("should handle whitespace-only API key as invalid", async () => {
      process.env.SENDGRID_API_KEY = "   "

      const SendGridAdapter = await importSendGridAdapter()
      const adapter = new SendGridAdapter()

      const isValid = await adapter.validateConfig()

      expect(isValid).toBe(false)
    })
  })
})
