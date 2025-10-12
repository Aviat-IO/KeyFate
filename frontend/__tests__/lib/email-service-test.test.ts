/**
 * @jest-environment node
 *
 * Task 24: Email Service Test Environment Configuration
 * TDD Implementation - Verify mock email service, template rendering, and environment variables
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  getEmailProvider,
  validateEmailProviderConfig,
} from "@/lib/email/email-factory"
import { MockAdapter } from "@/lib/email/providers/MockAdapter"
import type { EmailData } from "@/lib/email/providers/EmailProvider"

describe("Email Service Test Environment Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe("Mock Email Provider Configuration", () => {
    it("should use mock provider when EMAIL_PROVIDER is set to mock", () => {
      process.env.EMAIL_PROVIDER = "mock"

      const provider = getEmailProvider()

      expect(provider.getProviderName()).toBe("mock")
      expect(provider).toBeInstanceOf(MockAdapter)
    })

    it("should use mock provider by default in test environment", () => {
      process.env.NODE_ENV = "development"
      delete process.env.EMAIL_PROVIDER

      const provider = getEmailProvider()

      expect(provider.getProviderName()).toBe("mock")
    })

    it("should validate mock provider configuration successfully", () => {
      process.env.EMAIL_PROVIDER = "mock"

      const validation = validateEmailProviderConfig()

      expect(validation.valid).toBe(true)
      expect(validation.provider).toBe("mock")
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe("Mock Email Service Functionality", () => {
    let mockProvider: MockAdapter

    beforeEach(() => {
      process.env.EMAIL_PROVIDER = "mock"
      mockProvider = getEmailProvider() as MockAdapter
      mockProvider.clearSentEmails()
    })

    it("should send email successfully and store in memory", async () => {
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(emailData)

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(result.provider).toBe("mock")

      const sentEmails = mockProvider.getSentEmails()
      expect(sentEmails).toHaveLength(1)
      expect(sentEmails[0].to).toBe("test@example.com")
      expect(sentEmails[0].subject).toBe("Test Email")
    })

    it("should validate email data and reject invalid emails", async () => {
      const invalidEmailData: EmailData = {
        to: "",
        subject: "Test",
        html: "<p>Test</p>",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(invalidEmailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Missing recipient")
      expect(result.retryable).toBe(false)
    })

    it("should validate email format", async () => {
      const invalidFormatData: EmailData = {
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(invalidFormatData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid email format")
    })

    it("should reject emails without subject", async () => {
      const noSubjectData: EmailData = {
        to: "test@example.com",
        subject: "",
        html: "<p>Test</p>",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(noSubjectData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Missing email subject")
    })

    it("should reject emails without content", async () => {
      const noContentData: EmailData = {
        to: "test@example.com",
        subject: "Test",
        html: "",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(noContentData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Missing email content")
    })

    it("should simulate failure when configured", async () => {
      mockProvider.setSimulateFailure(true)

      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Mock failure simulation")
      expect(result.retryable).toBe(true)
    })

    it("should simulate rate limit when configured", async () => {
      mockProvider.setSimulateRateLimit(true)

      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("rate limit")
      expect(result.retryable).toBe(true)
      expect(result.retryAfter).toBe(60)
      expect(result.rateLimitInfo).toBeDefined()
    })

    it("should simulate network delay when configured", async () => {
      mockProvider.setSimulateDelay(100)

      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        from: "noreply@keyfate.com",
      }

      const startTime = Date.now()
      await mockProvider.sendEmail(emailData)
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThanOrEqual(100)
    })

    it("should clear sent emails", () => {
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        from: "noreply@keyfate.com",
      }

      mockProvider.sendEmail(emailData)
      expect(mockProvider.getSentEmails()).toHaveLength(1)

      mockProvider.clearSentEmails()
      expect(mockProvider.getSentEmails()).toHaveLength(0)
    })
  })

  describe("Email Template Rendering", () => {
    let mockProvider: MockAdapter

    beforeEach(() => {
      process.env.EMAIL_PROVIDER = "mock"
      mockProvider = getEmailProvider() as MockAdapter
      mockProvider.clearSentEmails()
    })

    it("should successfully send email with HTML template", async () => {
      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Email</title></head>
          <body>
            <h1>Hello Test User</h1>
            <p>This is a test email with HTML content.</p>
          </body>
        </html>
      `

      const emailData: EmailData = {
        to: "template-test@example.com",
        subject: "Template Test",
        html: htmlTemplate,
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(emailData)

      expect(result.success).toBe(true)

      const sentEmails = mockProvider.getSentEmails()
      expect(sentEmails[0].html).toContain("<h1>Hello Test User</h1>")
      expect(sentEmails[0].html).toContain("test email with HTML content")
    })

    it("should handle email templates with dynamic content", async () => {
      const userName = "John Doe"
      const verificationCode = "123456"

      const dynamicTemplate = `
        <html>
          <body>
            <p>Hello ${userName},</p>
            <p>Your verification code is: <strong>${verificationCode}</strong></p>
          </body>
        </html>
      `

      const emailData: EmailData = {
        to: "dynamic@example.com",
        subject: "Verification Code",
        html: dynamicTemplate,
        from: "noreply@keyfate.com",
      }

      const result = await mockProvider.sendEmail(emailData)

      expect(result.success).toBe(true)

      const sentEmails = mockProvider.getSentEmails()
      expect(sentEmails[0].html).toContain("John Doe")
      expect(sentEmails[0].html).toContain("123456")
    })
  })

  describe("Environment Variable Handling", () => {
    it("should read EMAIL_PROVIDER from environment", () => {
      process.env.EMAIL_PROVIDER = "mock"

      const validation = validateEmailProviderConfig()

      expect(validation.provider).toBe("mock")
      expect(validation.valid).toBe(true)
    })

    it("should detect missing SendGrid configuration when provider is sendgrid", () => {
      process.env.EMAIL_PROVIDER = "sendgrid"
      delete process.env.SENDGRID_API_KEY
      delete process.env.SENDGRID_ADMIN_EMAIL

      const validation = validateEmailProviderConfig()

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain(
        "SENDGRID_API_KEY environment variable is required",
      )
      expect(validation.errors).toContain(
        "SENDGRID_ADMIN_EMAIL environment variable is required",
      )
    })

    it("should validate SendGrid configuration when all variables are set", () => {
      process.env.EMAIL_PROVIDER = "sendgrid"
      process.env.SENDGRID_API_KEY = "test-key"
      process.env.SENDGRID_ADMIN_EMAIL = "admin@test.com"

      const validation = validateEmailProviderConfig()

      expect(validation.valid).toBe(true)
      expect(validation.provider).toBe("sendgrid")
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe("No Actual Emails Sent in Tests", () => {
    it("should never use SendGrid adapter in test environment", () => {
      process.env.EMAIL_PROVIDER = "mock"

      const provider = getEmailProvider()

      expect(provider.getProviderName()).toBe("mock")
      expect(provider).not.toHaveProperty("sendGridClient")
    })

    it("should keep all test emails in memory only", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const mockProvider = getEmailProvider() as MockAdapter
      mockProvider.clearSentEmails()

      // Send multiple test emails
      for (let i = 0; i < 5; i++) {
        await mockProvider.sendEmail({
          to: `test${i}@example.com`,
          subject: `Test ${i}`,
          html: `<p>Test content ${i}</p>`,
          from: "noreply@keyfate.com",
        })
      }

      // Verify all emails are in memory
      const sentEmails = mockProvider.getSentEmails()
      expect(sentEmails).toHaveLength(5)

      // Verify each email
      sentEmails.forEach((email, index) => {
        expect(email.to).toBe(`test${index}@example.com`)
        expect(email.messageId).toContain("mock-")
      })
    })

    it("should confirm mock provider config is active", async () => {
      const provider = getEmailProvider()

      expect(provider).toBeInstanceOf(MockAdapter)

      const isConfigValid = await provider.validateConfig()
      expect(isConfigValid).toBe(true)
    })
  })
})
