import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SendGridAdapter } from "../SendGridAdapter"

// Mock @sendgrid/mail
vi.mock("@sendgrid/mail", () => {
  const setApiKey = vi.fn()
  const send = vi.fn()
  return {
    default: { setApiKey, send },
    setApiKey,
    send,
  }
})

describe("SendGridAdapter", () => {
  let adapter: SendGridAdapter
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.SENDGRID_API_KEY = "SG.test-api-key"
    process.env.SENDGRID_ADMIN_EMAIL = "test@keyfate.com"
    process.env.SENDGRID_SENDER_NAME = "TestSender"
    adapter = new SendGridAdapter()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("validateConfig", () => {
    it("returns true when API key and admin email are set", async () => {
      expect(await adapter.validateConfig()).toBe(true)
    })

    it("returns false when API key is missing", async () => {
      delete process.env.SENDGRID_API_KEY
      expect(await adapter.validateConfig()).toBe(false)
    })

    it("returns false when admin email is missing", async () => {
      delete process.env.SENDGRID_ADMIN_EMAIL
      expect(await adapter.validateConfig()).toBe(false)
    })

    it("returns false when API key is empty string", async () => {
      process.env.SENDGRID_API_KEY = ""
      expect(await adapter.validateConfig()).toBe(false)
    })

    it("returns false when API key is whitespace only", async () => {
      process.env.SENDGRID_API_KEY = "   "
      expect(await adapter.validateConfig()).toBe(false)
    })
  })

  describe("getProviderName", () => {
    it("returns sendgrid", () => {
      expect(adapter.getProviderName()).toBe("sendgrid")
    })
  })

  describe("sendEmail", () => {
    const baseEmailData = {
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test content</p>",
      text: "Test content",
    }

    it("sends email successfully via SendGrid Web API", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      ;(sgMail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          statusCode: 202,
          headers: { "x-message-id": "test-msg-id-123" },
          body: "",
        },
        {},
      ])

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(true)
      expect(result.messageId).toBe("test-msg-id-123")
      expect(result.provider).toBe("sendgrid")
      expect(sgMail.setApiKey).toHaveBeenCalledWith("SG.test-api-key")
      expect(sgMail.send).toHaveBeenCalledTimes(1)
    })

    it("passes correct email data to SendGrid", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      ;(sgMail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { statusCode: 202, headers: { "x-message-id": "abc" }, body: "" },
        {},
      ])

      await adapter.sendEmail({
        ...baseEmailData,
        replyTo: "reply@example.com",
      })

      const sendCall = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(sendCall.to).toBe("recipient@example.com")
      expect(sendCall.subject).toBe("Test Subject")
      expect(sendCall.html).toBe("<p>Test content</p>")
      expect(sendCall.text).toBe("Test content")
      expect(sendCall.from).toEqual({ email: "test@keyfate.com", name: "TestSender" })
      expect(sendCall.replyTo).toBe("reply@example.com")
      expect(sendCall.trackingSettings.clickTracking.enable).toBe(false)
      expect(sendCall.trackingSettings.openTracking.enable).toBe(false)
    })

    it("includes ASM unsubscribe group when specified", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      ;(sgMail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { statusCode: 202, headers: { "x-message-id": "abc" }, body: "" },
        {},
      ])

      await adapter.sendEmail({
        ...baseEmailData,
        unsubscribeGroup: "CHECK_IN_REMINDERS",
      })

      const sendCall = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(sendCall.asm).toBeDefined()
      expect(sendCall.asm.groupId).toBe(341804)
    })

    it("returns config error when API key is missing", async () => {
      delete process.env.SENDGRID_API_KEY
      adapter = new SendGridAdapter()

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("configuration invalid")
      expect(result.retryable).toBe(false)
    })

    it("retries on transient errors", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      const sendFn = sgMail.send as ReturnType<typeof vi.fn>

      // Fail twice, then succeed
      sendFn
        .mockRejectedValueOnce(new Error("Connection reset"))
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce([
          { statusCode: 202, headers: { "x-message-id": "retry-success" }, body: "" },
          {},
        ])

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(3)
      expect(sendFn).toHaveBeenCalledTimes(3)
    })

    it("does not retry on auth errors", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      const sendFn = sgMail.send as ReturnType<typeof vi.fn>

      sendFn.mockRejectedValueOnce(new Error("Invalid API key"))

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(false)
      expect(result.attempts).toBe(1)
      expect(sendFn).toHaveBeenCalledTimes(1)
    })

    it("does not retry on 401 errors", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      const sendFn = sgMail.send as ReturnType<typeof vi.fn>

      const error = new Error("Unauthorized") as Error & { code: number }
      error.code = 401
      sendFn.mockRejectedValueOnce(error)

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(false)
      expect(result.retryable).toBe(false)
    })

    it("returns rate limit info on 429 errors", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      const sendFn = sgMail.send as ReturnType<typeof vi.fn>

      const error = new Error("429 Too Many Requests") as Error & { code: number }
      error.code = 429
      sendFn.mockRejectedValueOnce(error)

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Rate limit exceeded")
      expect(result.retryable).toBe(true)
      expect(result.retryAfter).toBe(60)
      expect(result.rateLimitInfo).toBeDefined()
    })

    it("returns failure after exhausting all retries", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      const sendFn = sgMail.send as ReturnType<typeof vi.fn>

      sendFn.mockRejectedValue(new Error("Connection timeout"))

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Connection timeout")
      expect(result.retryable).toBe(true)
      expect(result.attempts).toBe(3)
    })

    it("uses default sender name when SENDGRID_SENDER_NAME is not set", async () => {
      delete process.env.SENDGRID_SENDER_NAME
      adapter = new SendGridAdapter()

      const sgMail = (await import("@sendgrid/mail")).default
      ;(sgMail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { statusCode: 202, headers: { "x-message-id": "abc" }, body: "" },
        {},
      ])

      await adapter.sendEmail(baseEmailData)

      const sendCall = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(sendCall.from.name).toBe("Dead Man's Switch")
    })

    it("generates fallback message ID when header is missing", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      ;(sgMail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { statusCode: 202, headers: {}, body: "" },
        {},
      ])

      const result = await adapter.sendEmail(baseEmailData)

      expect(result.success).toBe(true)
      expect(result.messageId).toMatch(/^sg-/)
    })

    it("passes custom headers through", async () => {
      const sgMail = (await import("@sendgrid/mail")).default
      ;(sgMail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { statusCode: 202, headers: { "x-message-id": "abc" }, body: "" },
        {},
      ])

      await adapter.sendEmail({
        ...baseEmailData,
        headers: { "X-Priority": "1", Importance: "high" },
      })

      const sendCall = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(sendCall.headers["X-Priority"]).toBe("1")
      expect(sendCall.headers["Importance"]).toBe("high")
    })
  })
})
