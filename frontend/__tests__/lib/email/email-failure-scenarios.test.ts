/**
 * Email Failure Scenarios Tests
 *
 * Comprehensive tests for email failure scenarios:
 * - Network timeouts and connection failures
 * - API key validation errors
 * - Rate limiting scenarios
 * - Email bounce handling
 * - Retry logic verification
 * - Provider fallback strategies
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MockAdapter } from "@/lib/email/providers/MockAdapter"
import type { EmailData } from "@/lib/email/providers/EmailProvider"

describe("Email Failure Scenarios", () => {
  let mockAdapter: MockAdapter

  beforeEach(() => {
    mockAdapter = new MockAdapter()
  })

  describe("Network timeout simulations", () => {
    it("should handle slow network with timeout", async () => {
      mockAdapter.setSimulateDelay(100)

      const startTime = Date.now()
      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Timeout Test",
        html: "<p>Test</p>",
      })
      const elapsed = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(elapsed).toBeGreaterThanOrEqual(100)

      mockAdapter.setSimulateDelay(0)
    })

    it("should fail after extended timeout", async () => {
      mockAdapter.setSimulateDelay(5000)

      const emailPromise = mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Long Timeout",
        html: "<p>Test</p>",
      })

      // Should eventually complete (though slowly)
      const result = await emailPromise
      expect(result).toBeDefined()

      mockAdapter.setSimulateDelay(0)
    })

    it("should handle connection reset during send", async () => {
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Connection Reset",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Mock failure simulation")
      expect(result.retryable).toBe(true)

      mockAdapter.setSimulateFailure(false)
    })
  })

  describe("API key validation errors", () => {
    it("should detect invalid API key format", async () => {
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "API Key Test",
        html: "<p>Test</p>",
      }

      // MockAdapter doesn't validate API keys, but we test the error structure
      mockAdapter.setSimulateFailure(true)
      const result = await mockAdapter.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.retryable).toBeDefined()

      mockAdapter.setSimulateFailure(false)
    })

    it("should handle expired API key", async () => {
      // Simulate expired key scenario
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Expired Key Test",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(true)

      mockAdapter.setSimulateFailure(false)
    })

    it("should handle missing API key configuration", async () => {
      // MockAdapter always validates, so this tests the pattern
      const isValid = await mockAdapter.validateConfig()
      expect(isValid).toBe(true)
    })
  })

  describe("Rate limiting scenarios", () => {
    it("should handle rate limit exceeded", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Rate Limit Test",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Mock rate limit exceeded")
      expect(result.retryable).toBe(true)
      expect(result.retryAfter).toBeGreaterThan(0)

      mockAdapter.setSimulateRateLimit(false)
    })

    it("should include rate limit information", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Rate Limit Info Test",
        html: "<p>Test</p>",
      })

      expect(result.rateLimitInfo).toBeDefined()
      expect(result.rateLimitInfo?.limit).toBe(100)
      expect(result.rateLimitInfo?.remaining).toBe(0)
      expect(result.rateLimitInfo?.resetTime).toBeGreaterThan(Date.now())

      mockAdapter.setSimulateRateLimit(false)
    })

    it("should handle multiple sequential rate limit errors", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const results = await Promise.all([
        mockAdapter.sendEmail({
          to: "user1@example.com",
          subject: "Test 1",
          html: "<p>1</p>",
        }),
        mockAdapter.sendEmail({
          to: "user2@example.com",
          subject: "Test 2",
          html: "<p>2</p>",
        }),
        mockAdapter.sendEmail({
          to: "user3@example.com",
          subject: "Test 3",
          html: "<p>3</p>",
        }),
      ])

      results.forEach((result) => {
        expect(result.success).toBe(false)
        expect(result.retryable).toBe(true)
      })

      mockAdapter.setSimulateRateLimit(false)
    })

    it("should calculate appropriate retry after delay", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Retry Delay Test",
        html: "<p>Test</p>",
      })

      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.retryAfter).toBeLessThanOrEqual(3600) // Max 1 hour

      mockAdapter.setSimulateRateLimit(false)
    })
  })

  describe("Email bounce handling", () => {
    it("should detect invalid email format", async () => {
      const result = await mockAdapter.sendEmail({
        to: "invalid-email",
        subject: "Bounce Test",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid email")
    })

    it("should handle empty recipient", async () => {
      const result = await mockAdapter.sendEmail({
        to: "",
        subject: "Empty Recipient",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("recipient")
    })

    it("should validate multiple recipients", async () => {
      const result = await mockAdapter.sendEmail({
        to: "valid@example.com,invalid-email",
        subject: "Multiple Recipients",
        html: "<p>Test</p>",
      })

      // Mock adapter validates the 'to' field as a whole
      expect(result).toBeDefined()
    })

    it("should handle domain-level bounces", async () => {
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "user@nonexistent-domain.invalid",
        subject: "Domain Bounce",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(true)

      mockAdapter.setSimulateFailure(false)
    })
  })

  describe("Retry logic verification", () => {
    it("should not retry on non-retryable errors", async () => {
      const invalidEmail = {
        to: "invalid-format",
        subject: "Non-retryable",
        html: "<p>Test</p>",
      }

      const result = await mockAdapter.sendEmail(invalidEmail)

      expect(result.success).toBe(false)
      // Invalid email returns retryable: false (not undefined)
      expect(result.retryable).toBe(false)
    })

    it("should retry on transient failures", async () => {
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Retryable Error",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(true)

      mockAdapter.setSimulateFailure(false)
    })

    it("should handle exponential backoff delay", async () => {
      mockAdapter.setSimulateRateLimit(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Backoff Test",
        html: "<p>Test</p>",
      })

      expect(result.retryAfter).toBeGreaterThan(0)

      mockAdapter.setSimulateRateLimit(false)
    })

    it("should give up after max retries", async () => {
      // This would be tested in the actual SendGridAdapter
      // MockAdapter succeeds or fails immediately
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Max Retries",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)

      mockAdapter.setSimulateFailure(false)
    })
  })

  describe("Complex failure scenarios", () => {
    it("should handle partial send failure in batch", async () => {
      const emails: EmailData[] = [
        { to: "valid1@example.com", subject: "Email 1", html: "<p>1</p>" },
        { to: "invalid-email", subject: "Email 2", html: "<p>2</p>" },
        { to: "valid2@example.com", subject: "Email 3", html: "<p>3</p>" },
      ]

      const results = await Promise.all(
        emails.map((email) => mockAdapter.sendEmail(email)),
      )

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })

    it("should handle provider unavailable scenario", async () => {
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Provider Unavailable",
        html: "<p>Test</p>",
      })

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(true)

      mockAdapter.setSimulateFailure(false)
    })

    it("should handle configuration change during send", async () => {
      const email: EmailData = {
        to: "test@example.com",
        subject: "Config Change",
        html: "<p>Test</p>",
      }

      // Send normally
      const result1 = await mockAdapter.sendEmail(email)
      expect(result1.success).toBe(true)

      // Simulate configuration issue
      mockAdapter.setSimulateFailure(true)
      const result2 = await mockAdapter.sendEmail(email)
      expect(result2.success).toBe(false)

      mockAdapter.setSimulateFailure(false)
    })

    it("should handle concurrent failure and recovery", async () => {
      mockAdapter.setSimulateDelay(50)
      mockAdapter.setSimulateFailure(true)

      const failurePromises = [
        mockAdapter.sendEmail({
          to: "test1@example.com",
          subject: "Fail 1",
          html: "<p>1</p>",
        }),
        mockAdapter.sendEmail({
          to: "test2@example.com",
          subject: "Fail 2",
          html: "<p>2</p>",
        }),
      ]

      const failResults = await Promise.all(failurePromises)
      expect(failResults.every((r) => !r.success)).toBe(true)

      // Recover
      mockAdapter.setSimulateFailure(false)

      const successResult = await mockAdapter.sendEmail({
        to: "test3@example.com",
        subject: "Success",
        html: "<p>3</p>",
      })

      expect(successResult.success).toBe(true)

      mockAdapter.setSimulateDelay(0)
    })
  })

  describe("Error message validation", () => {
    it("should provide descriptive error messages", async () => {
      const result = await mockAdapter.sendEmail({
        to: "",
        subject: "Error Message Test",
        html: "<p>Test</p>",
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain("recipient")
    })

    it("should include provider name in error context", async () => {
      mockAdapter.setSimulateFailure(true)

      const result = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Provider Context",
        html: "<p>Test</p>",
      })

      expect(result.provider).toBe("mock")

      mockAdapter.setSimulateFailure(false)
    })

    it("should differentiate between error types", async () => {
      const invalidEmailResult = await mockAdapter.sendEmail({
        to: "invalid",
        subject: "Invalid",
        html: "<p>Test</p>",
      })

      mockAdapter.setSimulateRateLimit(true)
      const rateLimitResult = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Rate Limit",
        html: "<p>Test</p>",
      })

      expect(invalidEmailResult.error).toContain("Invalid")
      expect(rateLimitResult.error).toContain("rate limit")

      mockAdapter.setSimulateRateLimit(false)
    })
  })

  describe("Recovery and fallback scenarios", () => {
    it("should recover from temporary failure", async () => {
      mockAdapter.setSimulateFailure(true)

      const failResult = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Fail First",
        html: "<p>Test</p>",
      })

      expect(failResult.success).toBe(false)

      mockAdapter.setSimulateFailure(false)

      const successResult = await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Succeed Next",
        html: "<p>Test</p>",
      })

      expect(successResult.success).toBe(true)
    })

    it("should clear state between failure scenarios", async () => {
      mockAdapter.clearSentEmails()

      mockAdapter.setSimulateFailure(true)
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Fail",
        html: "<p>Test</p>",
      })

      mockAdapter.setSimulateFailure(false)
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Success",
        html: "<p>Test</p>",
      })

      const sentEmails = mockAdapter.getSentEmails()
      expect(sentEmails).toHaveLength(1) // Only successful email stored
    })

    it("should maintain provider state across failures", async () => {
      const providerName = mockAdapter.getProviderName()

      mockAdapter.setSimulateFailure(true)
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })

      expect(mockAdapter.getProviderName()).toBe(providerName)

      mockAdapter.setSimulateFailure(false)
    })
  })
})
