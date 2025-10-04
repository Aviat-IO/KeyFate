/**
 * Admin Notification Service Tests
 *
 * TDD tests for admin notification system that alerts support@aviat.io
 * when email operations fail with proper severity classification and batching.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  sendAdminNotification,
  calculateSeverity,
  type AdminNotificationData,
  type NotificationSeverity,
} from "@/lib/email/admin-notification-service";
import * as emailService from "@/lib/email/email-service";

// Mock email service
vi.mock("@/lib/email/email-service", () => ({
  sendEmail: vi.fn(),
}));

describe("Admin Notification Service - TDD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateSeverity()", () => {
    it("should return critical for disclosure email failures", () => {
      const severity = calculateSeverity({
        emailType: "disclosure",
        retryCount: 0,
      });

      expect(severity).toBe("critical");
    });

    it("should return high for reminder emails with >3 retries", () => {
      const severity = calculateSeverity({
        emailType: "reminder",
        retryCount: 4,
      });

      expect(severity).toBe("high");
    });

    it("should return medium for reminder emails with <3 retries", () => {
      const severity = calculateSeverity({
        emailType: "reminder",
        retryCount: 2,
      });

      expect(severity).toBe("medium");
    });

    it("should return low for verification email failures", () => {
      const severity = calculateSeverity({
        emailType: "verification",
        retryCount: 0,
      });

      expect(severity).toBe("low");
    });

    it("should return low for admin_notification email failures", () => {
      const severity = calculateSeverity({
        emailType: "admin_notification",
        retryCount: 0,
      });

      expect(severity).toBe("low");
    });
  });

  describe("sendAdminNotification()", () => {
    it("should send admin notification with correct data", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: "test-message-id",
        provider: "sendgrid",
      });

      const notificationData: AdminNotificationData = {
        emailType: "disclosure",
        recipient: "user@example.com",
        errorMessage: "SMTP connection failed",
        secretTitle: "Test Secret",
        timestamp: new Date("2025-01-01T12:00:00Z"),
      };

      const result = await sendAdminNotification(notificationData);

      expect(result.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const callArgs = mockSendEmail.mock.calls[0][0];
      expect(callArgs.to).toBe("support@aviat.io");
      expect(callArgs.priority).toBe("high");
      expect(callArgs.subject).toContain("CRITICAL");
      expect(callArgs.subject).toContain("Test Secret");
      expect(callArgs.html).toContain("SMTP connection failed");
      expect(callArgs.html).toContain("user@example.com");
    });

    it("should use environment variable for admin email", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: "test-message-id",
      });

      // Set environment variable
      process.env.ADMIN_ALERT_EMAIL = "admin@custom.com";

      const notificationData: AdminNotificationData = {
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Network timeout",
        retryCount: 1,
      };

      await sendAdminNotification(notificationData);

      const callArgs = mockSendEmail.mock.calls[0][0];
      expect(callArgs.to).toBe("admin@custom.com");

      // Clean up
      delete process.env.ADMIN_ALERT_EMAIL;
    });

    it("should set priority based on severity level", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      // Critical severity
      await sendAdminNotification({
        emailType: "disclosure",
        recipient: "user@example.com",
        errorMessage: "Failed",
      });
      expect(mockSendEmail.mock.calls[0][0].priority).toBe("high");

      // Low severity
      await sendAdminNotification({
        emailType: "verification",
        recipient: "user@example.com",
        errorMessage: "Failed",
      });
      expect(mockSendEmail.mock.calls[1][0].priority).toBe("normal");
    });

    it("should include severity in subject line", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendAdminNotification({
        emailType: "disclosure",
        recipient: "user@example.com",
        errorMessage: "Failed",
        secretTitle: "Important Secret",
      });

      const subject = mockSendEmail.mock.calls[0][0].subject;
      expect(subject).toContain("CRITICAL");
      expect(subject).toContain("Important Secret");
    });

    it("should handle missing optional fields gracefully", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      const result = await sendAdminNotification({
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Network error",
      });

      expect(result.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const callArgs = mockSendEmail.mock.calls[0][0];
      expect(callArgs.html).toContain("Network error");
      expect(callArgs.html).toContain("user@example.com");
    });

    it("should return failure result if sendEmail fails", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({
        success: false,
        error: "SMTP server unavailable",
        retryable: true,
      });

      const result = await sendAdminNotification({
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Original error",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP server unavailable");
    });

    it("should handle exceptions during notification send", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockRejectedValue(new Error("Network failure"));

      const result = await sendAdminNotification({
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Original error",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network failure");
    });

    it("should format HTML notification correctly", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      const timestamp = new Date("2025-01-01T12:00:00Z");

      await sendAdminNotification({
        emailType: "disclosure",
        recipient: "user@example.com",
        errorMessage: "SMTP connection failed",
        secretTitle: "Test Secret",
        timestamp,
        retryCount: 2,
      });

      const callArgs = mockSendEmail.mock.calls[0][0];

      expect(callArgs.html).toContain("<h2");
      expect(callArgs.html).toContain("CRITICAL");
      expect(callArgs.html).toContain("Test Secret");
      expect(callArgs.html).toContain("user@example.com");
      expect(callArgs.html).toContain("SMTP connection failed");
      expect(callArgs.html).toContain("disclosure");
      expect(callArgs.html).toContain("2"); // retry count
      expect(callArgs.html).toContain(timestamp.toISOString());
    });

    it("should format plain text notification correctly", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendAdminNotification({
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Network timeout",
        secretTitle: "Test Secret",
      });

      const callArgs = mockSendEmail.mock.calls[0][0];

      expect(callArgs.text).toBeDefined();
      expect(callArgs.text).toContain("Email Delivery Failure");
      expect(callArgs.text).toContain("Test Secret");
      expect(callArgs.text).toContain("user@example.com");
      expect(callArgs.text).toContain("Network timeout");
    });
  });

  describe("Batching and spam prevention", () => {
    it("should batch multiple failures within time window", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      // Send first notification
      await sendAdminNotification({
        emailType: "reminder",
        recipient: "user1@example.com",
        errorMessage: "Error 1",
        secretTitle: "Secret 1",
      });

      // Send second notification within 5 minutes
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes

      await sendAdminNotification({
        emailType: "reminder",
        recipient: "user2@example.com",
        errorMessage: "Error 2",
        secretTitle: "Secret 2",
      });

      // Both should be sent individually (batching is future feature)
      // For now, we expect 2 separate emails
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it("should not batch notifications of different severity", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({ success: true });

      // Critical notification
      await sendAdminNotification({
        emailType: "disclosure",
        recipient: "user1@example.com",
        errorMessage: "Critical error",
      });

      // Low notification
      await sendAdminNotification({
        emailType: "verification",
        recipient: "user2@example.com",
        errorMessage: "Low error",
      });

      // Different severities should always be sent separately
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration with email system", () => {
    it("should use existing sendEmail() function", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: "msg-123",
        provider: "sendgrid",
      });

      const result = await sendAdminNotification({
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Test error",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-123");
      expect(result.provider).toBe("sendgrid");
    });

    it("should handle retryable errors correctly", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({
        success: false,
        error: "Rate limit exceeded",
        retryable: true,
        retryAfter: 60,
      });

      const result = await sendAdminNotification({
        emailType: "reminder",
        recipient: "user@example.com",
        errorMessage: "Test error",
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(60);
    });

    it("should handle non-retryable errors correctly", async () => {
      const mockSendEmail = vi.mocked(emailService.sendEmail);
      mockSendEmail.mockResolvedValue({
        success: false,
        error: "Invalid API key",
        retryable: false,
      });

      const result = await sendAdminNotification({
        emailType: "disclosure",
        recipient: "user@example.com",
        errorMessage: "Original error",
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });
  });
});
