/**
 * Email Provider E2E Workflow Tests
 *
 * Tests complete email workflows that would be used by cron jobs:
 * - Disclosure email flow simulation
 * - Reminder email flow simulation
 * - Failure handling and logging flows
 * - Bulk email sending scenarios
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockAdapter } from "@/lib/email/providers/MockAdapter";
import type { EmailData } from "@/lib/email/providers/EmailProvider";

describe("Email Provider E2E Workflows", () => {
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    mockAdapter.clearSentEmails();
  });

  describe("Secret disclosure email workflow", () => {
    it("should send disclosure email successfully", async () => {
      const disclosureEmail: EmailData = {
        to: "recipient@example.com",
        subject: "Important Message from John Doe",
        html: `
          <h1>Message from John Doe</h1>
          <p>You have received an important message.</p>
          <div class="secret-content">
            <h2>Test Secret</h2>
            <p>This is the decrypted secret content.</p>
          </div>
        `,
        text: "You have received an important message from John Doe. Secret content: This is the decrypted secret content.",
        priority: "high",
      };

      const result = await mockAdapter.sendEmail(disclosureEmail);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("mock");
      expect(result.messageId).toBeDefined();

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe("recipient@example.com");
    });

    it("should handle disclosure email failure gracefully", async () => {
      mockAdapter.setSimulateFailure(true);

      const disclosureEmail: EmailData = {
        to: "recipient@example.com",
        subject: "Important Message",
        html: "<p>Secret content</p>",
        priority: "high",
      };

      const result = await mockAdapter.sendEmail(disclosureEmail);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toBeDefined();

      // No emails should be stored on failure
      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(0);

      mockAdapter.setSimulateFailure(false);
    });

    it("should track delivery for disclosure emails", async () => {
      const disclosureEmail: EmailData = {
        to: "recipient@example.com",
        subject: "Important Message",
        html: "<p>Secret content</p>",
        trackDelivery: true,
        priority: "high",
      };

      const result = await mockAdapter.sendEmail(disclosureEmail);

      expect(result.success).toBe(true);
      expect(result.trackingEnabled).toBe(true);
    });
  });

  describe("Reminder email workflow", () => {
    it("should send reminder email successfully", async () => {
      const reminderEmail: EmailData = {
        to: "user@example.com",
        subject: "Reminder: Check-in Required in 2 Days",
        html: `
          <h1>Check-in Reminder</h1>
          <p>Hi Test User,</p>
          <p>This is a reminder that your secret "Important Secret" requires check-in in 2 days.</p>
          <a href="https://example.com/checkin">Check In Now</a>
        `,
        text: "Check-in reminder: Your secret 'Important Secret' requires check-in in 2 days. Visit: https://example.com/checkin",
        priority: "normal",
      };

      const result = await mockAdapter.sendEmail(reminderEmail);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("mock");

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].subject).toContain("Reminder");
    });

    it("should handle reminder email rate limiting", async () => {
      mockAdapter.setSimulateRateLimit(true);

      const reminderEmail: EmailData = {
        to: "user@example.com",
        subject: "Reminder: Check-in Required",
        html: "<p>Reminder content</p>",
      };

      const result = await mockAdapter.sendEmail(reminderEmail);

      expect(result.success).toBe(false);
      expect(result.error).toContain("rate limit");
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);

      mockAdapter.setSimulateRateLimit(false);
    });
  });

  describe("Bulk email sending workflow", () => {
    it("should handle multiple disclosure emails in sequence", async () => {
      const emails: EmailData[] = [
        {
          to: "recipient1@example.com",
          subject: "Secret Disclosure 1",
          html: "<p>Secret 1</p>",
          priority: "high",
        },
        {
          to: "recipient2@example.com",
          subject: "Secret Disclosure 2",
          html: "<p>Secret 2</p>",
          priority: "high",
        },
        {
          to: "recipient3@example.com",
          subject: "Secret Disclosure 3",
          html: "<p>Secret 3</p>",
          priority: "high",
        },
      ];

      const results = await Promise.all(
        emails.map((email) => mockAdapter.sendEmail(email))
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(3);
    });

    it("should handle partial failures in bulk send", async () => {
      const emails: EmailData[] = [
        {
          to: "valid1@example.com",
          subject: "Email 1",
          html: "<p>Content 1</p>",
        },
        {
          to: "invalid-email",
          subject: "Email 2",
          html: "<p>Content 2</p>",
        },
        {
          to: "valid2@example.com",
          subject: "Email 3",
          html: "<p>Content 3</p>",
        },
      ];

      const results = await Promise.all(
        emails.map((email) => mockAdapter.sendEmail(email))
      );

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(2); // Only valid emails stored
    });
  });

  describe("Admin notification workflow", () => {
    it("should send admin notification for email failure", async () => {
      const adminNotification: EmailData = {
        to: "support@aviat.io",
        subject: "CRITICAL: Email Delivery Failure - Secret Disclosure",
        html: `
          <h1>Email Delivery Failure</h1>
          <p><strong>Severity:</strong> CRITICAL</p>
          <p><strong>Email Type:</strong> disclosure</p>
          <p><strong>Provider:</strong> mock</p>
          <p><strong>Recipient:</strong> recipient@example.com</p>
          <p><strong>Error:</strong> SMTP connection timeout</p>
          <p><strong>Retryable:</strong> Yes</p>
        `,
        text: "CRITICAL: Email delivery failure for disclosure email. Provider: mock, Recipient: recipient@example.com",
        priority: "high",
      };

      const result = await mockAdapter.sendEmail(adminNotification);

      expect(result.success).toBe(true);

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails[0].subject).toContain("CRITICAL");
      expect(sentEmails[0].to).toBe("support@aviat.io");
    });

    it("should handle admin notification failure", async () => {
      mockAdapter.setSimulateFailure(true);

      const adminNotification: EmailData = {
        to: "support@aviat.io",
        subject: "Email Delivery Failure",
        html: "<p>Failure notification</p>",
        priority: "high",
      };

      const result = await mockAdapter.sendEmail(adminNotification);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);

      mockAdapter.setSimulateFailure(false);
    });
  });

  describe("Email retry workflow", () => {
    it("should handle retry after rate limit", async () => {
      mockAdapter.setSimulateRateLimit(true);

      const email: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test</p>",
      };

      // First attempt - should fail with rate limit
      const firstResult = await mockAdapter.sendEmail(email);
      expect(firstResult.success).toBe(false);
      expect(firstResult.retryAfter).toBeGreaterThan(0);

      // Simulate waiting for retry delay
      mockAdapter.setSimulateRateLimit(false);

      // Retry - should succeed
      const retryResult = await mockAdapter.sendEmail(email);
      expect(retryResult.success).toBe(true);
    });

    it("should recover from transient failure", async () => {
      mockAdapter.setSimulateFailure(true);

      const email: EmailData = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test</p>",
      };

      // First attempt - fails
      const failResult = await mockAdapter.sendEmail(email);
      expect(failResult.success).toBe(false);

      // Recover
      mockAdapter.setSimulateFailure(false);

      // Retry - succeeds
      const successResult = await mockAdapter.sendEmail(email);
      expect(successResult.success).toBe(true);
    });
  });

  describe("Email validation workflow", () => {
    it("should validate email addresses before sending", async () => {
      const invalidEmails = [
        { to: "", subject: "Test", html: "<p>Test</p>" },
        { to: "invalid-email", subject: "Test", html: "<p>Test</p>" },
        { to: "@example.com", subject: "Test", html: "<p>Test</p>" },
        { to: "user@", subject: "Test", html: "<p>Test</p>" },
      ];

      const results = await Promise.all(
        invalidEmails.map((email) => mockAdapter.sendEmail(email))
      );

      results.forEach((result) => {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });

    it("should accept valid email addresses", async () => {
      const validEmails = [
        "user@example.com",
        "test.user@example.co.uk",
        "user+tag@example.com",
      ];

      for (const email of validEmails) {
        const result = await mockAdapter.sendEmail({
          to: email,
          subject: "Test",
          html: "<p>Test</p>",
        });

        expect(result.success).toBe(true);
      }

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(validEmails.length);
    });
  });

  describe("Email priority handling workflow", () => {
    it("should handle high priority disclosure emails", async () => {
      const highPriorityEmail: EmailData = {
        to: "recipient@example.com",
        subject: "URGENT: Secret Disclosure",
        html: "<p>Urgent secret content</p>",
        priority: "high",
      };

      const result = await mockAdapter.sendEmail(highPriorityEmail);

      expect(result.success).toBe(true);

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails[0].priority).toBe("high");
    });

    it("should handle normal priority reminder emails", async () => {
      const normalPriorityEmail: EmailData = {
        to: "user@example.com",
        subject: "Reminder: Check-in Required",
        html: "<p>Reminder content</p>",
        priority: "normal",
      };

      const result = await mockAdapter.sendEmail(normalPriorityEmail);

      expect(result.success).toBe(true);

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails[0].priority).toBe("normal");
    });
  });

  describe("Email state management workflow", () => {
    it("should maintain email history", async () => {
      const emails: EmailData[] = [
        { to: "user1@example.com", subject: "Email 1", html: "<p>1</p>" },
        { to: "user2@example.com", subject: "Email 2", html: "<p>2</p>" },
        { to: "user3@example.com", subject: "Email 3", html: "<p>3</p>" },
      ];

      for (const email of emails) {
        await mockAdapter.sendEmail(email);
      }

      const sentEmails = mockAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(3);
      expect(sentEmails.map((e) => e.to)).toEqual([
        "user1@example.com",
        "user2@example.com",
        "user3@example.com",
      ]);
    });

    it("should clear email history on demand", async () => {
      await mockAdapter.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockAdapter.getSentEmails()).toHaveLength(1);

      mockAdapter.clearSentEmails();

      expect(mockAdapter.getSentEmails()).toHaveLength(0);
    });
  });
});
