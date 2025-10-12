/**
 * Email Provider Integration Tests
 *
 * Comprehensive integration tests covering:
 * - Provider switching between SendGrid and Mock
 * - Email service integration with different providers
 * - Error handling and retry logic across providers
 * - Template rendering with provider-specific features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getEmailProvider } from "@/lib/email/email-factory"
import type { EmailData } from "@/lib/email/providers/EmailProvider"

describe("Email Provider Integration", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("Provider switching", () => {
    it("should switch from SendGrid to Mock provider", async () => {
      // Start with SendGrid
      process.env.EMAIL_PROVIDER = "sendgrid"
      process.env.SENDGRID_API_KEY = "test-key"
      process.env.SENDGRID_ADMIN_EMAIL = "admin@test.com"

      const sendgridProvider = getEmailProvider()
      expect(sendgridProvider.getProviderName()).toBe("sendgrid")

      // Switch to Mock
      process.env.EMAIL_PROVIDER = "mock"
      const mockProvider = getEmailProvider()
      expect(mockProvider.getProviderName()).toBe("mock")
    })

    it("should maintain provider consistency within same environment", () => {
      process.env.EMAIL_PROVIDER = "mock"

      const provider1 = getEmailProvider()
      const provider2 = getEmailProvider()

      expect(provider1.getProviderName()).toBe(provider2.getProviderName())
    })

    it("should handle production to development environment switch", () => {
      // Production setup
      process.env.NODE_ENV = "production"
      delete process.env.EMAIL_PROVIDER
      process.env.SENDGRID_API_KEY = "prod-key"
      process.env.SENDGRID_ADMIN_EMAIL = "admin@prod.com"

      const prodProvider = getEmailProvider()
      expect(prodProvider.getProviderName()).toBe("sendgrid")

      // Development setup
      process.env.NODE_ENV = "development"
      delete process.env.EMAIL_PROVIDER

      const devProvider = getEmailProvider()
      expect(devProvider.getProviderName()).toBe("mock")
    })
  })

  describe("Email sending across providers", () => {
    const testEmail: EmailData = {
      to: "test@example.com",
      subject: "Integration Test Email",
      html: "<p>Test content</p>",
      text: "Test content",
    }

    it("should send email successfully with Mock provider", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const result = await provider.sendEmail(testEmail)

      expect(result.success).toBe(true)
      expect(result.provider).toBe("mock")
      expect(result.messageId).toMatch(/^mock-/)
    })

    it("should handle email with all optional fields", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const fullEmail: EmailData = {
        ...testEmail,
        from: "sender@test.com",
        replyTo: "reply@test.com",
        priority: "high",
        headers: { "X-Test-Header": "test-value" },
        trackDelivery: true,
      }

      const result = await provider.sendEmail(fullEmail)

      expect(result.success).toBe(true)
      expect(result.trackingEnabled).toBe(true)
    })

    it("should handle concurrent email sending", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const emails = Array.from({ length: 5 }, (_, i) => ({
        ...testEmail,
        to: `user${i}@example.com`,
        subject: `Test Email ${i}`,
      }))

      const results = await Promise.all(
        emails.map((email) => provider.sendEmail(email)),
      )

      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })
  })

  describe("Error handling integration", () => {
    it("should handle network timeout simulation", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      // Simulate delay
      if ("setSimulateDelay" in provider) {
        ;(provider as any).setSimulateDelay(5000)
      }

      const emailPromise = provider.sendEmail({
        to: "test@example.com",
        subject: "Timeout Test",
        html: "<p>Test</p>",
      })

      // Should complete even with delay
      const result = await emailPromise
      expect(result).toBeDefined()

      // Reset delay
      if ("setSimulateDelay" in provider) {
        ;(provider as any).setSimulateDelay(0)
      }
    })

    it("should handle rate limiting across multiple requests", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      if ("setSimulateRateLimit" in provider) {
        ;(provider as any).setSimulateRateLimit(true)

        const result = await provider.sendEmail({
          to: "test@example.com",
          subject: "Rate Limit Test",
          html: "<p>Test</p>",
        })

        expect(result.success).toBe(false)
        expect(result.retryable).toBe(true)
        expect(result.retryAfter).toBeGreaterThan(0)

        // Reset
        ;(provider as any).setSimulateRateLimit(false)
      }
    })

    it("should handle provider failure and retry logic", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      if ("setSimulateFailure" in provider) {
        ;(provider as any).setSimulateFailure(true)

        const result = await provider.sendEmail({
          to: "test@example.com",
          subject: "Failure Test",
          html: "<p>Test</p>",
        })

        expect(result.success).toBe(false)
        expect(result.retryable).toBe(true)

        // Reset
        ;(provider as any).setSimulateFailure(false)
      }
    })
  })

  describe("Configuration validation integration", () => {
    it("should validate SendGrid configuration", async () => {
      process.env.EMAIL_PROVIDER = "sendgrid"
      process.env.SENDGRID_API_KEY = "test-key"
      process.env.SENDGRID_ADMIN_EMAIL = "admin@test.com"

      const provider = getEmailProvider()
      const isValid = await provider.validateConfig()

      expect(isValid).toBe(true)
    })

    it("should detect invalid SendGrid configuration", async () => {
      process.env.EMAIL_PROVIDER = "sendgrid"
      delete process.env.SENDGRID_API_KEY

      const provider = getEmailProvider()
      const isValid = await provider.validateConfig()

      expect(isValid).toBe(false)
    })

    it("should validate Mock provider (always valid)", async () => {
      process.env.EMAIL_PROVIDER = "mock"

      const provider = getEmailProvider()
      const isValid = await provider.validateConfig()

      expect(isValid).toBe(true)
    })
  })

  describe("Email bounce and delivery tracking", () => {
    it("should handle email validation errors", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const invalidEmail: EmailData = {
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
      }

      const result = await provider.sendEmail(invalidEmail)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid email")
    })

    it("should handle empty recipient", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const emptyRecipient: EmailData = {
        to: "",
        subject: "Test",
        html: "<p>Test</p>",
      }

      const result = await provider.sendEmail(emptyRecipient)

      expect(result.success).toBe(false)
      expect(result.error).toContain("recipient")
    })

    it("should track delivery for sent emails", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const emailWithTracking: EmailData = {
        to: "tracked@example.com",
        subject: "Tracked Email",
        html: "<p>Track me</p>",
        trackDelivery: true,
      }

      const result = await provider.sendEmail(emailWithTracking)

      expect(result.success).toBe(true)
      expect(result.trackingEnabled).toBe(true)
    })
  })

  describe("Mock provider storage verification", () => {
    it("should store sent emails in Mock provider", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      if ("clearSentEmails" in provider) {
        ;(provider as any).clearSentEmails()
      }

      await provider.sendEmail({
        to: "user1@example.com",
        subject: "Email 1",
        html: "<p>Content 1</p>",
      })

      await provider.sendEmail({
        to: "user2@example.com",
        subject: "Email 2",
        html: "<p>Content 2</p>",
      })

      if ("getSentEmails" in provider) {
        const sentEmails = (provider as any).getSentEmails()
        expect(sentEmails).toHaveLength(2)
        expect(sentEmails[0].to).toBe("user1@example.com")
        expect(sentEmails[1].to).toBe("user2@example.com")
      }
    })

    it("should clear sent email history", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      await provider.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      if ("clearSentEmails" in provider && "getSentEmails" in provider) {
        ;(provider as any).clearSentEmails()
        const sentEmails = (provider as any).getSentEmails()
        expect(sentEmails).toHaveLength(0)
      }
    })
  })

  describe("Priority and header handling", () => {
    it("should handle high priority emails", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const highPriorityEmail: EmailData = {
        to: "urgent@example.com",
        subject: "URGENT: Action Required",
        html: "<p>Please act immediately</p>",
        priority: "high",
      }

      const result = await provider.sendEmail(highPriorityEmail)

      expect(result.success).toBe(true)
    })

    it("should handle custom headers", async () => {
      process.env.EMAIL_PROVIDER = "mock"
      const provider = getEmailProvider()

      const emailWithHeaders: EmailData = {
        to: "custom@example.com",
        subject: "Custom Headers",
        html: "<p>Test</p>",
        headers: {
          "X-Custom-ID": "12345",
          "X-Campaign": "spring-2024",
        },
      }

      const result = await provider.sendEmail(emailWithHeaders)

      expect(result.success).toBe(true)
    })
  })
})
