/**
 * Email Provider Interface Tests
 *
 * Tests for EmailProvider interface compliance and type safety.
 * These tests ensure that any implementation of EmailProvider
 * follows the contract defined by the interface.
 */

import type {
  EmailData,
  EmailProvider,
  EmailResult,
} from "@/lib/email/providers/EmailProvider";

describe("EmailProvider Interface", () => {
  // Mock implementation for testing interface compliance
  class MockEmailProvider implements EmailProvider {
    async sendEmail(data: EmailData): Promise<EmailResult> {
      return {
        success: true,
        messageId: "mock-123",
        provider: "mock",
      };
    }

    async validateConfig(): Promise<boolean> {
      return true;
    }

    getProviderName(): string {
      return "mock";
    }
  }

  describe("EmailProvider interface compliance", () => {
    it("should require sendEmail method", async () => {
      const provider: EmailProvider = new MockEmailProvider();

      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        text: "Test content",
      };

      const result = await provider.sendEmail(emailData);

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("should require validateConfig method", async () => {
      const provider: EmailProvider = new MockEmailProvider();
      const isValid = await provider.validateConfig();

      expect(typeof isValid).toBe("boolean");
    });

    it("should require getProviderName method", () => {
      const provider: EmailProvider = new MockEmailProvider();
      const name = provider.getProviderName();

      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe("EmailData interface", () => {
    it("should require basic email fields", () => {
      const emailData: EmailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>HTML content</p>",
      };

      expect(emailData.to).toBe("recipient@example.com");
      expect(emailData.subject).toBe("Test Subject");
      expect(emailData.html).toBe("<p>HTML content</p>");
    });

    it("should support optional fields", () => {
      const emailData: EmailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>HTML content</p>",
        text: "Plain text content",
        from: "sender@example.com",
        replyTo: "reply@example.com",
        priority: "high",
        headers: { "X-Custom": "value" },
        trackDelivery: true,
      };

      expect(emailData.text).toBe("Plain text content");
      expect(emailData.from).toBe("sender@example.com");
      expect(emailData.replyTo).toBe("reply@example.com");
      expect(emailData.priority).toBe("high");
      expect(emailData.headers).toEqual({ "X-Custom": "value" });
      expect(emailData.trackDelivery).toBe(true);
    });

    it("should enforce priority type constraints", () => {
      const priorities: Array<"high" | "normal" | "low"> = [
        "high",
        "normal",
        "low",
      ];

      priorities.forEach((priority) => {
        const emailData: EmailData = {
          to: "test@example.com",
          subject: "Test",
          html: "<p>Test</p>",
          priority,
        };

        expect(emailData.priority).toBe(priority);
      });
    });
  });

  describe("EmailResult interface", () => {
    it("should require success field", () => {
      const result: EmailResult = {
        success: true,
      };

      expect(result.success).toBe(true);
    });

    it("should support all optional result fields", () => {
      const result: EmailResult = {
        success: true,
        messageId: "msg-123",
        provider: "sendgrid",
        error: undefined,
        retryable: false,
        retryAfter: undefined,
        attempts: 1,
        trackingEnabled: true,
        rateLimitInfo: {
          limit: 100,
          remaining: 99,
          resetTime: Date.now() + 3600000,
        },
      };

      expect(result.messageId).toBe("msg-123");
      expect(result.provider).toBe("sendgrid");
      expect(result.attempts).toBe(1);
      expect(result.trackingEnabled).toBe(true);
      expect(result.rateLimitInfo?.limit).toBe(100);
    });

    it("should support error results", () => {
      const result: EmailResult = {
        success: false,
        error: "Failed to send email",
        retryable: true,
        retryAfter: 60,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to send email");
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(60);
    });
  });

  describe("Type safety", () => {
    it("should prevent invalid EmailData types at compile time", () => {
      // This test validates TypeScript compile-time checks
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        // @ts-expect-error - priority must be "high" | "normal" | "low"
        priority: "invalid",
      };

      // Runtime check
      expect(emailData.priority).toBe("invalid");
    });

    it("should ensure EmailProvider implementation completeness", () => {
      // This test ensures any EmailProvider implementation has all required methods
      class IncompleteProvider {
        // Missing sendEmail and validateConfig methods
        getProviderName(): string {
          return "incomplete";
        }
      }

      // @ts-expect-error - Class must implement all EmailProvider methods
      const _provider: EmailProvider = new IncompleteProvider();

      // TypeScript will catch this at compile time
      expect(true).toBe(true);
    });
  });
});
