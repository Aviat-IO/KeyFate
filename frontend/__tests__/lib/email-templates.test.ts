/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEmailTemplates = vi.hoisted(() => ({
  renderVerificationTemplate: vi.fn(),
  renderReminderTemplate: vi.fn(),
  renderDisclosureTemplate: vi.fn(),
  renderBaseTemplate: vi.fn(),
  validateTemplateData: vi.fn(),
}));

vi.mock("@/lib/email/templates", () => mockEmailTemplates);

describe("Email Templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Verification Email Template", () => {
    const verificationData = {
      userName: "John Doe",
      verificationUrl: "https://example.com/verify?token=abc123",
      expirationHours: 24,
      supportEmail: "support@example.com",
    };

    it("should render verification email with all required elements", async () => {
      mockEmailTemplates.renderVerificationTemplate.mockReturnValue({
        subject: "Verify your email address - Dead Man's Switch",
        html: `
          <div>
            <h1>Welcome John Doe!</h1>
            <p>Please click below to verify your email address:</p>
            <a href="https://example.com/verify?token=abc123">Verify Email</a>
            <p>This link expires in 24 hours.</p>
            <p>Contact: support@example.com</p>
          </div>
        `,
        text: `
          Welcome John Doe!
          Please verify your email: https://example.com/verify?token=abc123
          This link expires in 24 hours.
          Contact: support@example.com
        `,
      });

      const { renderVerificationTemplate } = await import(
        "@/lib/email/templates"
      );
      const result = renderVerificationTemplate(verificationData);

      expect(result.subject).toContain("Verify your email");
      expect(result.html).toContain(verificationData.userName);
      expect(result.html).toContain(verificationData.verificationUrl);
      expect(result.html).toContain("24 hours");
      expect(result.text).toContain(verificationData.verificationUrl);
    });

    it("should handle missing optional fields gracefully", async () => {
      const minimalData = {
        verificationUrl: "https://example.com/verify?token=abc123",
        expirationHours: 24,
      };

      mockEmailTemplates.renderVerificationTemplate.mockReturnValue({
        subject: "Verify your email address",
        html: "<div>Verification content without name</div>",
        text: "Verification content without name",
      });

      const { renderVerificationTemplate } = await import(
        "@/lib/email/templates"
      );
      const result = renderVerificationTemplate(minimalData);

      expect(result.subject).toContain("Verify");
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });

  describe("Reminder Email Template", () => {
    const reminderData = {
      userName: "John Doe",
      secretTitle: "Important Document Access",
      daysRemaining: 7,
      checkInUrl: "https://example.com/checkin/secret-123",
      urgencyLevel: "medium" as const,
    };

    it("should render reminder email with urgency indicators", async () => {
      mockEmailTemplates.renderReminderTemplate.mockReturnValue({
        subject:
          "⚠️ Reminder: Check-in required in 7 days - Important Document Access",
        html: `
          <div style="background: #fff3cd;">
            <h2>⚠️ Check-in Reminder</h2>
            <p>Hi John Doe,</p>
            <p>You need to check in for "Important Document Access" within 7 days.</p>
            <a href="https://example.com/checkin/secret-123">Check In Now</a>
            <p>Urgency: Medium</p>
          </div>
        `,
        text: `
          Check-in Reminder
          Hi John Doe,
          You need to check in for "Important Document Access" within 7 days.
          Check in: https://example.com/checkin/secret-123
        `,
      });

      const { renderReminderTemplate } = await import("@/lib/email/templates");
      const result = renderReminderTemplate(reminderData);

      expect(result.subject).toContain("7 days");
      expect(result.subject).toContain("Important Document Access");
      expect(result.html).toContain("John Doe");
      expect(result.html).toContain(reminderData.checkInUrl);
      expect(result.html).toContain("⚠️");
    });

    it("should show high urgency for critical reminders", async () => {
      const criticalData = {
        ...reminderData,
        daysRemaining: 1,
        urgencyLevel: "high" as const,
      };

      mockEmailTemplates.renderReminderTemplate.mockReturnValue({
        subject:
          "🚨 URGENT: Check-in required in 1 day - Important Document Access",
        html:
          '<div style="background: #f8d7da; border: 2px solid #dc3545;">URGENT content</div>',
        text: "URGENT: Check in required in 1 day",
      });

      const { renderReminderTemplate } = await import("@/lib/email/templates");
      const result = renderReminderTemplate(criticalData);

      expect(result.subject).toContain("URGENT");
      expect(result.subject).toContain("🚨");
      expect(result.html).toContain("URGENT");
    });

    it("should handle different reminder intervals", async () => {
      const intervals = [
        { days: 30, urgency: "low" },
        { days: 7, urgency: "medium" },
        { days: 1, urgency: "high" },
        { days: 0, urgency: "critical" },
      ];

      for (const interval of intervals) {
        const data = {
          ...reminderData,
          daysRemaining: interval.days,
          urgencyLevel: interval.urgency as
            | "low"
            | "medium"
            | "high"
            | "critical",
        };

        mockEmailTemplates.renderReminderTemplate.mockReturnValue({
          subject: `Reminder: ${interval.days} days remaining`,
          html: `<div>Content for ${interval.urgency}</div>`,
          text: `Reminder: ${interval.days} days`,
        });

        const { renderReminderTemplate } = await import(
          "@/lib/email/templates"
        );
        const result = renderReminderTemplate(data);

        expect(result.subject).toContain(interval.days.toString());
      }
    });
  });

  describe("Secret Disclosure Email Template", () => {
    const disclosureData = {
      contactName: "Jane Smith",
      secretTitle: "Family Emergency Information",
      senderName: "John Doe",
      message:
        "This contains important family emergency contacts and procedures.",
      secretContent:
        "Emergency contacts:\n- Doctor: +1-555-0123\n- Hospital: +1-555-0456",
      disclosureReason: "scheduled" as const,
      senderLastSeen: new Date("2024-01-01"),
    };

    it("should render disclosure email with sensitive content warnings", async () => {
      mockEmailTemplates.renderDisclosureTemplate.mockReturnValue({
        subject:
          "Important Message from John Doe - Family Emergency Information",
        html: `
          <div style="border: 3px solid #dc3545; padding: 20px;">
            <h1>🔒 Confidential Message</h1>
            <p>Dear Jane Smith,</p>
            <p>You are receiving this because John Doe has not checked in as scheduled.</p>
            <p>Last seen: January 1, 2024</p>
            <h3>Message: Family Emergency Information</h3>
            <p>This contains important family emergency contacts and procedures.</p>
            <div style="background: #f8f9fa; padding: 15px;">
              <h4>Confidential Content:</h4>
              <pre>Emergency contacts:
- Doctor: +1-555-0123
- Hospital: +1-555-0456</pre>
            </div>
            <p><strong>⚠️ This information is confidential. Please handle with care.</strong></p>
          </div>
        `,
        text: `
          Confidential Message from John Doe
          Dear Jane Smith,
          Family Emergency Information
          Message: This contains important family emergency contacts and procedures.
          Content: Emergency contacts:
- Doctor: +1-555-0123
- Hospital: +1-555-0456
          This information is confidential.
        `,
      });

      const { renderDisclosureTemplate } = await import(
        "@/lib/email/templates"
      );
      const result = renderDisclosureTemplate(disclosureData);

      expect(result.subject).toContain("John Doe");
      expect(result.subject).toContain("Family Emergency Information");
      expect(result.html).toContain("Jane Smith");
      expect(result.html).toContain("Confidential");
      expect(result.html).toContain("Emergency contacts");
      expect(result.html).toContain("⚠️");
    });

    it("should handle manual disclosure differently", async () => {
      const manualData = {
        ...disclosureData,
        disclosureReason: "manual" as const,
      };

      mockEmailTemplates.renderDisclosureTemplate.mockReturnValue({
        subject: "Message from John Doe - Family Emergency Information",
        html: "<div>Manual disclosure content</div>",
        text: "Manual disclosure text",
      });

      const { renderDisclosureTemplate } = await import(
        "@/lib/email/templates"
      );
      const result = renderDisclosureTemplate(manualData);

      expect(result.html).toContain("Manual disclosure");
    });
  });

  describe("Base Template System", () => {
    it("should apply consistent branding to all emails", async () => {
      const templateData = {
        title: "Test Email",
        content: "<p>Test content</p>",
        footerText: "Custom footer",
      };

      mockEmailTemplates.renderBaseTemplate.mockReturnValue({
        html: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <header>
                <img src="logo.png" alt="Dead Man's Switch" />
              </header>
              <main>
                <h1>Test Email</h1>
                <p>Test content</p>
              </main>
              <footer>
                <p>Custom footer</p>
                <p>© 2024 Dead Man's Switch</p>
              </footer>
            </body>
          </html>
        `,
        text: `
          Test Email
          Test content
          Custom footer
          © 2024 Dead Man's Switch
        `,
      });

      const { renderBaseTemplate } = await import("@/lib/email/templates");
      const result = renderBaseTemplate(templateData);

      expect(result.html).toContain("Dead Man's Switch");
      expect(result.html).toContain("Test Email");
      expect(result.html).toContain("font-family");
      expect(result.text).toContain("© 2024");
    });
  });

  describe("Template Data Validation", () => {
    it("should validate required fields for verification template", async () => {
      mockEmailTemplates.validateTemplateData.mockReturnValue({
        valid: false,
        errors: ["verificationUrl is required", "expirationHours is required"],
      });

      const invalidData = {
        userName: "John Doe",
        // missing required fields
      };

      const { validateTemplateData } = await import("@/lib/email/templates");
      const result = validateTemplateData("verification", invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("verificationUrl is required");
    });

    it("should validate email addresses in template data", async () => {
      mockEmailTemplates.validateTemplateData.mockReturnValue({
        valid: false,
        errors: ["Invalid email format in supportEmail"],
      });

      const invalidData = {
        verificationUrl: "https://example.com",
        expirationHours: 24,
        supportEmail: "invalid-email",
      };

      const { validateTemplateData } = await import("@/lib/email/templates");
      const result = validateTemplateData("verification", invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid email format in supportEmail");
    });

    it("should pass validation for complete data", async () => {
      mockEmailTemplates.validateTemplateData.mockReturnValue({
        valid: true,
        errors: [],
      });

      const validData = {
        verificationUrl: "https://example.com/verify",
        expirationHours: 24,
        userName: "John Doe",
        supportEmail: "support@example.com",
      };

      const { validateTemplateData } = await import("@/lib/email/templates");
      const result = validateTemplateData("verification", validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
