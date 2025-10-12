/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MockAdapter } from "../MockAdapter"
import type { EmailData } from "../EmailProvider"

describe("MockAdapter", () => {
  let mockAdapter: MockAdapter

  beforeEach(() => {
    mockAdapter = new MockAdapter()
  })

  describe("validateConfig", () => {
    it("should always return true for mock adapter", async () => {
      const isValid = await mockAdapter.validateConfig()
      expect(isValid).toBe(true)
    })
  })

  describe("getProviderName", () => {
    it("should return 'mock'", () => {
      expect(mockAdapter.getProviderName()).toBe("mock")
    })
  })

  describe("sendEmail", () => {
    it("should successfully send email in default mode", async () => {
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        text: "Test content",
      }

      const result = await mockAdapter.sendEmail(emailData)

      expect(result.success).toBe(true)
      expect(result.provider).toBe("mock")
      expect(result.messageId).toMatch(/^mock-/)
    })

    it("should store sent emails in memory", async () => {
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      }

      await mockAdapter.sendEmail(emailData)
      const sentEmails = mockAdapter.getSentEmails()

      expect(sentEmails).toHaveLength(1)
      expect(sentEmails[0].to).toBe("test@example.com")
      expect(sentEmails[0].subject).toBe("Test Email")
    })

    it("should store multiple emails", async () => {
      await mockAdapter.sendEmail({
        to: "test1@example.com",
        subject: "Email 1",
        html: "<p>Content 1</p>",
      })

      await mockAdapter.sendEmail({
        to: "test2@example.com",
        subject: "Email 2",
        html: "<p>Content 2</p>",
      })

      const sentEmails = mockAdapter.getSentEmails()
      expect(sentEmails).toHaveLength(2)
      expect(sentEmails[0].to).toBe("test1@example.com")
      expect(sentEmails[1].to).toBe("test2@example.com")
    })

    it("should clear sent emails", async () => {
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      mockAdapter.clearSentEmails()
      expect(mockAdapter.getSentEmails()).toHaveLength(0)
    })
  })

  describe("failure simulation", () => {
    it("should simulate failure when configured", async () => {
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Mock failure simulation")
      expect(result.retryable).toBe(true)
    })

    it("should reset to success after failure simulation", async () => {
      mockAdapter.setSimulateFailure(true)
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      mockAdapter.setSimulateFailure(false)
      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(true)
    })

    it("should not store emails when failure is simulated", async () => {
      mockAdapter.setSimulateFailure(true)
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      expect(mockAdapter.getSentEmails()).toHaveLength(0)
    })
  })

  describe("network delay simulation", () => {
    it("should simulate network delay when configured", async () => {
      mockAdapter.setSimulateDelay(100)

      const startTime = Date.now()
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(100)
    })

    it("should not delay when set to 0", async () => {
      mockAdapter.setSimulateDelay(0)

      const startTime = Date.now()
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(50)
    })
  })

  describe("console logging", () => {
    let consoleSpy: any

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it("should log to console in development mode", async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test</p>",
      })

      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain("Mock Email Sent")

      process.env.NODE_ENV = originalEnv
    })

    it("should not log in production mode", async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test</p>",
      })

      expect(consoleSpy).not.toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })
  })

  describe("rate limit simulation", () => {
    it("should simulate rate limit when configured", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Mock rate limit exceeded")
      expect(result.retryable).toBe(true)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it("should include rate limit info when simulated", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      expect(result.rateLimitInfo).toBeDefined()
      expect(result.rateLimitInfo?.limit).toBe(100)
      expect(result.rateLimitInfo?.remaining).toBe(0)
      expect(result.rateLimitInfo?.resetTime).toBeGreaterThan(Date.now())
    })
  })

  describe("email validation", () => {
    it("should validate required fields", async () => {
      const invalidEmail = {
        to: "",
        subject: "Test",
        html: "<p>Test</p>",
      }

      const result = await mockAdapter.sendEmail(invalidEmail)

      expect(result.success).toBe(false)
      expect(result.error).toContain("recipient")
    })

    it("should validate email format", async () => {
      const invalidEmail = {
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
      }

      const result = await mockAdapter.sendEmail(invalidEmail)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid email")
    })
  })
})
