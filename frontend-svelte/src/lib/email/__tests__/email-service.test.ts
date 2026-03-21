import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock the email factory before importing the service
vi.mock("../email-factory", () => {
  const mockProvider = {
    sendEmail: vi.fn(),
    validateConfig: vi.fn(),
    getProviderName: vi.fn().mockReturnValue("sendgrid"),
  }
  return {
    getEmailProvider: vi.fn().mockReturnValue(mockProvider),
  }
})

// Mock the circuit breaker
vi.mock("$lib/circuit-breaker", () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
    getState: vi.fn().mockReturnValue("CLOSED"),
    getStats: vi.fn().mockReturnValue({ state: "CLOSED", failureCount: 0 }),
    reset: vi.fn(),
  })),
}))

// Mock logger
vi.mock("$lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock env
vi.mock("$lib/env", () => ({
  SITE_URL: "https://test.keyfate.com",
}))

import {
  sendEmail,
  sendReminderEmail,
  sendSecretDisclosureEmail,
  validateEmailConfig,
} from "../email-service"
import { getEmailProvider } from "../email-factory"

describe("email-service", () => {
  let mockProvider: ReturnType<typeof getEmailProvider>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.NODE_ENV = "production"
    process.env.SENDGRID_API_KEY = "SG.test"
    process.env.SENDGRID_ADMIN_EMAIL = "test@keyfate.com"
    vi.clearAllMocks()
    mockProvider = getEmailProvider()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("sendEmail", () => {
    it("delegates to the provider and returns result", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(mockProvider.sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        messageId: "test-123",
        provider: "sendgrid",
      })

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe("test-123")
      expect(mockProvider.sendEmail).toHaveBeenCalledTimes(1)
    })

    it("passes email data through to provider", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(mockProvider.sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        messageId: "abc",
        provider: "sendgrid",
      })

      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Body</p>",
        text: "Body",
        priority: "high",
        unsubscribeGroup: "CHECK_IN_REMINDERS",
      })

      const callArg = (mockProvider.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArg.to).toBe("user@example.com")
      expect(callArg.subject).toBe("Test Subject")
      expect(callArg.unsubscribeGroup).toBe("CHECK_IN_REMINDERS")
    })

    it("returns error when circuit breaker is open", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      // Make the circuit breaker throw
      const { CircuitBreaker } = await import("$lib/circuit-breaker")
      const cbInstance = new CircuitBreaker("test")
      ;(cbInstance.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Circuit breaker is OPEN - EmailService service unavailable"),
      )

      // Since the module caches the circuit breaker, we need to test the error path directly
      ;(mockProvider.sendEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Circuit breaker is OPEN - EmailService service unavailable"),
      )

      // The actual circuit breaker mock passes through, so simulate at provider level
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      })

      expect(result.success).toBe(false)
    })

    it("uses dev mode logging when in development with mock provider", async () => {
      process.env.NODE_ENV = "development"
      ;(mockProvider.getProviderName as ReturnType<typeof vi.fn>).mockReturnValue("mock")
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      const result = await sendEmail({
        to: "dev@example.com",
        subject: "Dev Test",
        html: "<p>Dev</p>",
        text: "Dev text",
      })

      expect(result.success).toBe(true)
      expect(result.provider).toBe("console-dev")
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it("returns provider failure result", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(mockProvider.sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Connection timeout",
        retryable: true,
      })

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Connection timeout")
    })
  })

  describe("validateEmailConfig", () => {
    it("returns valid when provider config is valid", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const result = await validateEmailConfig()

      expect(result.valid).toBe(true)
      // Provider name comes from the mock which returns the factory's provider
      expect(result.missingVars).toEqual([])
    })

    it("returns invalid when provider config fails", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(false)
      delete process.env.SENDGRID_API_KEY

      const result = await validateEmailConfig()

      expect(result.valid).toBe(false)
      expect(result.missingVars).toContain("SENDGRID_API_KEY")
    })

    it("returns dev mode when in development and config fails", async () => {
      process.env.NODE_ENV = "development"
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const result = await validateEmailConfig()

      expect(result.valid).toBe(true)
      expect(result.developmentMode).toBe(true)
    })
  })

  describe("sendReminderEmail", () => {
    it("renders template and sends via provider", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(mockProvider.sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        messageId: "reminder-123",
        provider: "sendgrid",
      })

      const result = await sendReminderEmail({
        userEmail: "user@example.com",
        userName: "Test User",
        secretTitle: "My Secret",
        daysRemaining: 2,
        checkInUrl: "https://keyfate.com/check-in?token=abc",
        urgencyLevel: "high",
        reminderType: "24_hours",
      })

      expect(result.success).toBe(true)
      expect(result.templateUsed).toBe("reminder")
    })
  })

  describe("sendSecretDisclosureEmail", () => {
    it("renders template and sends via provider", async () => {
      ;(mockProvider.validateConfig as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(mockProvider.sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        messageId: "disclosure-456",
        provider: "sendgrid",
      })

      const result = await sendSecretDisclosureEmail({
        contactEmail: "recipient@example.com",
        contactName: "Recipient",
        secretTitle: "Test Secret",
        senderName: "Sender",
        message: "Disclosure message",
        secretContent: "secret content here",
        disclosureReason: "scheduled",
      })

      expect(result.success).toBe(true)
      expect(result.templateUsed).toBe("disclosure")
    })
  })
})
