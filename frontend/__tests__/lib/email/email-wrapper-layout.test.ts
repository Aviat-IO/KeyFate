/**
 * @jest-environment node
 */

import { describe, expect, it } from "vitest";
import {
  renderBaseTemplate,
  renderVerificationTemplate,
  renderReminderTemplate,
  renderDisclosureTemplate,
} from "@/lib/email/templates";

describe("Email Layout Constraints - TDD", () => {
  describe("Email Wrapper Max-Width Constraint", () => {
    it("should apply 600px max-width to base template wrapper", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      // Email clients need max-width on table element
      expect(result.html).toContain('max-width: 600px');
      // Table-based layouts use align="center" for centering
      expect(result.html).toContain('align="center"');
    });

    it("should use table-based layout for email client compatibility", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      // Table-based layouts work better across email clients
      expect(result.html).toContain('<table');
      expect(result.html).toMatch(/width="100%"/);
    });

    it("should center email content horizontally", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      // Table-based email layouts use align="center" for horizontal centering
      expect(result.html).toContain('align="center"');
      expect(result.html).toContain('text-align: center');
    });

    it("should apply responsive padding for mobile devices", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      // Mobile-friendly padding
      expect(result.html).toMatch(/padding:\s*20px/);
    });
  });

  describe("Verification Email Layout", () => {
    it("should apply max-width constraint to verification email", () => {
      const result = renderVerificationTemplate({
        verificationUrl: "https://example.com/verify",
        expirationHours: 24,
      });

      expect(result.html).toContain('max-width: 600px');
    });

    it("should maintain mobile responsiveness in verification email", () => {
      const result = renderVerificationTemplate({
        verificationUrl: "https://example.com/verify",
        expirationHours: 24,
      });

      // Should have viewport meta tag
      expect(result.html).toContain('name="viewport"');
      expect(result.html).toContain('width=device-width');
    });
  });

  describe("Reminder Email Layout", () => {
    it("should apply max-width constraint to reminder email", () => {
      const result = renderReminderTemplate({
        userName: "Test User",
        secretTitle: "Test Secret",
        daysRemaining: 7,
        checkInUrl: "https://example.com/checkin",
      });

      expect(result.html).toContain('max-width: 600px');
    });

    it("should maintain button layout within max-width constraint", () => {
      const result = renderReminderTemplate({
        userName: "Test User",
        secretTitle: "Test Secret",
        daysRemaining: 7,
        checkInUrl: "https://example.com/checkin",
      });

      // Buttons should be within constrained layout
      expect(result.html).toContain('class="button"');
      expect(result.html).toContain('max-width: 600px');
    });
  });

  describe("Disclosure Email Layout", () => {
    it("should apply max-width constraint to disclosure email", () => {
      const result = renderDisclosureTemplate({
        contactName: "Test Contact",
        secretTitle: "Test Secret",
        senderName: "Test Sender",
        message: "Test message",
        secretContent: "Test content",
      });

      expect(result.html).toContain('max-width: 600px');
    });

    it("should handle long secret content within max-width", () => {
      const longContent = "A".repeat(1000);
      const result = renderDisclosureTemplate({
        contactName: "Test Contact",
        secretTitle: "Test Secret",
        senderName: "Test Sender",
        message: "Test message",
        secretContent: longContent,
      });

      // Should have word-break for long content
      expect(result.html).toContain('word-break');
      expect(result.html).toContain('max-width: 600px');
    });
  });

  describe("Cross-Email Client Compatibility", () => {
    it("should use inline styles for critical layout properties", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      // Inline styles are used for table layout and positioning
      expect(result.html).toContain('style="');

      // Critical properties should be inline
      expect(result.html).toContain('style="max-width: 600px');
      expect(result.html).toContain('style="padding:');
    });

    it("should include DOCTYPE for HTML email rendering", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      expect(result.html).toContain('<!DOCTYPE html>');
    });

    it("should use table-based layout for maximum compatibility", () => {
      const result = renderBaseTemplate({
        title: "Test Email",
        content: "<p>Test content</p>",
      });

      // Tables are more reliable than divs in email clients
      expect(result.html).toContain('<table');
      expect(result.html).toMatch(/cellpadding="0"/);
      expect(result.html).toMatch(/cellspacing="0"/);
    });
  });

  describe("Payment Email Templates (Existing)", () => {
    it("should verify payment templates already have max-width (regression test)", async () => {
      // This test documents that email-templates.ts already has proper constraints
      // We're importing from the other file to verify it remains unchanged
      const { emailTemplates } = await import("@/lib/services/email-templates");

      const result = emailTemplates.subscriptionConfirmation({
        userName: "Test User",
        tierName: "premium",
        provider: "stripe" as const,
        amount: 1000,
        interval: "month",
        nextBillingDate: new Date(),
      });

      expect(result.html).toContain('max-width: 600px');
    });
  });
});
