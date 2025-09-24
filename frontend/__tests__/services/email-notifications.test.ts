import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock SMTP service
const mockSMTPService = {
  sendEmail: vi.fn(),
};

vi.mock("@/lib/services/smtp-service", () => ({
  smtpService: mockSMTPService,
}));

// Mock database
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: "user123",
            email: "test@example.com",
            name: "Test User",
          }),
        }),
      }),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-id" }]),
    }),
  }),
};

vi.mock("@/lib/db/drizzle", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  users: {
    id: "id",
    email: "email",
    name: "name",
  },
  emailNotifications: {
    id: "id",
    recipientEmail: "recipientEmail",
    subject: "subject",
    body: "body",
    sentAt: "sentAt",
    failedAt: "failedAt",
    error: "error",
    createdAt: "createdAt",
  },
}));

describe("Email Notifications Service Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default database mock to return a user
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: "user123",
            email: "test@example.com",
            name: "Test User",
          }]),
        }),
      }),
    });

    // Set up default SMTP mock
    mockSMTPService.sendEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Payment Event Notifications", () => {
    it("should send subscription confirmation email", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendSubscriptionConfirmation("user123", {
        provider: "stripe",
        tierName: "pro",
        amount: 1999,
        interval: "month",
      });

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: expect.stringContaining("Subscription Confirmed"),
        html: expect.stringContaining("Pro"),
        text: expect.any(String),
      });
    });

    it("should send payment failed notification", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendPaymentFailedNotification("user123", {
        provider: "stripe",
        subscriptionId: "sub_test123",
        amount: 1999,
        attemptCount: 1,
        nextRetry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: expect.stringContaining("Payment Failed"),
        html: expect.stringMatching(/payment failed/i),
        text: expect.any(String),
      });
    });

    it("should send subscription cancelled notification", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendSubscriptionCancelledNotification("user123");

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: expect.stringContaining("Subscription Cancelled"),
        html: expect.stringContaining("cancelled"),
        text: expect.any(String),
      });
    });

    it("should send trial will end notification", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendTrialWillEndNotification("user123", {
        daysRemaining: 3,
        trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: expect.stringContaining("Trial Ending"),
        html: expect.stringContaining("3 days"),
        text: expect.any(String),
      });
    });

    it("should send Bitcoin payment confirmation", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendBitcoinPaymentConfirmation("user123", {
        invoiceId: "invoice123",
        amount: 0.001,
        currency: "BTC",
        tierName: "pro",
        confirmations: 6,
      });

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: expect.stringContaining("Bitcoin Payment Confirmed"),
        html: expect.stringContaining("0.001 BTC"),
        text: expect.any(String),
      });
    });
  });

  describe("Admin Notifications", () => {
    it("should send admin alert for failed webhooks", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendAdminAlert({
        type: "webhook_failure",
        severity: "high",
        message: "Stripe webhook failed validation",
        details: {
          provider: "stripe",
          eventType: "customer.subscription.created",
          error: "Invalid signature",
        },
      });

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: expect.stringContaining("admin"),
        subject: expect.stringContaining("Admin Alert"),
        html: expect.stringContaining("webhook failed"),
        text: expect.any(String),
      });
    });

    it("should send admin alert for multiple payment failures", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({ success: true });

      // Act
      await emailService.sendAdminAlert({
        type: "payment_failures",
        severity: "medium",
        message: "Multiple payment failures detected",
        details: {
          count: 5,
          timeframe: "1 hour",
          providers: ["stripe", "btcpay"],
        },
      });

      // Assert
      expect(mockSMTPService.sendEmail).toHaveBeenCalledWith({
        to: expect.stringContaining("admin"),
        subject: expect.stringContaining("Admin Alert"),
        html: expect.stringMatching(
          /payment_failures|Multiple payment failures/i,
        ),
        text: expect.any(String),
      });
    });
  });

  describe("Email Templates", () => {
    it("should generate proper HTML template for subscription confirmation", async () => {
      // Arrange
      const { emailTemplates } = await import("@/lib/services/email-templates");

      // Act
      const template = emailTemplates.subscriptionConfirmation({
        userName: "Test User",
        tierName: "pro",
        provider: "stripe",
        amount: 1999,
        interval: "month",
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Assert
      expect(template.subject).toContain("Subscription Confirmed");
      expect(template.html).toContain("Test User");
      expect(template.html).toContain("Pro");
      expect(template.html).toContain("$19.99");
      expect(template.text).toBeTruthy();
    });

    it("should generate proper HTML template for payment failure", async () => {
      // Arrange
      const { emailTemplates } = await import("@/lib/services/email-templates");

      // Act
      const template = emailTemplates.paymentFailed({
        userName: "Test User",
        amount: 1999,
        provider: "stripe",
        attemptCount: 2,
        maxAttempts: 3,
        nextRetry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Assert
      expect(template.subject).toContain("Payment Failed");
      expect(template.html).toContain("Test User");
      expect(template.html).toContain("$19.99");
      expect(template.html).toMatch(/attempt\s+2\s+of\s+3/i);
      expect(template.text).toBeTruthy();
    });

    it("should generate Bitcoin-specific template", async () => {
      // Arrange
      const { emailTemplates } = await import("@/lib/services/email-templates");

      // Act
      const template = emailTemplates.bitcoinPaymentConfirmation({
        userName: "Test User",
        amount: 0.001,
        currency: "BTC",
        tierName: "pro",
        confirmations: 6,
        transactionId: "tx123abc",
      });

      // Assert
      expect(template.subject).toContain("Bitcoin Payment Confirmed");
      expect(template.html).toContain("0.001 BTC");
      expect(template.html).toMatch(/Confirmations:<\/strong>\s*6\/6/);
      expect(template.html).toContain("tx123abc");
      expect(template.text).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should handle SMTP service failures gracefully", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockRejectedValue(
        new Error("SMTP connection failed"),
      );

      // Act & Assert - should not throw
      await expect(
        emailService.sendSubscriptionConfirmation("user123", {
          provider: "stripe",
          tierName: "pro",
          amount: 1999,
          interval: "month",
        }),
      ).resolves.not.toThrow();

      // Should log failure to database
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle user not found gracefully", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });

      // Act & Assert - should not throw
      await expect(
        emailService.sendSubscriptionConfirmation("nonexistent", {
          provider: "stripe",
          tierName: "pro",
          amount: 1999,
          interval: "month",
        }),
      ).resolves.not.toThrow();
    });

    it("should retry failed email deliveries", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce({ success: true });

      // Act
      await emailService.sendSubscriptionConfirmation("user123", {
        provider: "stripe",
        tierName: "pro",
        amount: 1999,
        interval: "month",
      });

      // Assert - should have retried
      expect(mockSMTPService.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe("Email Delivery Tracking", () => {
    it("should log successful email delivery", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockResolvedValue({
        success: true,
        messageId: "msg123",
      });

      let captured: any = null;
      (mockDb.insert as any).mockReturnValueOnce({
        values: (v: any) => {
          captured = v;
          return { returning: vi.fn().mockResolvedValue([{ id: "email-id" }]) };
        },
      });

      // Act
      await emailService.sendSubscriptionConfirmation("user123", {
        provider: "stripe",
        tierName: "pro",
        amount: 1999,
        interval: "month",
      });

      // Assert
      expect(captured).toEqual(
        expect.objectContaining({ sentAt: expect.any(Date) }),
      );
    });

    it("should log failed email delivery", async () => {
      // Arrange
      const { emailService } = await import("@/lib/services/email-service");

      mockSMTPService.sendEmail.mockRejectedValue(new Error("SMTP error"));

      let captured: any = null;
      (mockDb.insert as any).mockReturnValueOnce({
        values: (v: any) => {
          captured = v;
          return { returning: vi.fn().mockResolvedValue([{ id: "email-id" }]) };
        },
      });

      // Act
      await emailService.sendSubscriptionConfirmation("user123", {
        provider: "stripe",
        tierName: "pro",
        amount: 1999,
        interval: "month",
      });

      // Assert
      expect(captured).toEqual(
        expect.objectContaining({ failedAt: expect.any(Date) }),
      );
    });
  });
});
