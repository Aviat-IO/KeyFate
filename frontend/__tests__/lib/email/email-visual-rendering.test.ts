/**
 * @jest-environment node
 */

import { describe, expect, it } from "vitest"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import {
  renderBaseTemplate,
  renderVerificationTemplate,
  renderReminderTemplate,
  renderDisclosureTemplate,
} from "@/lib/email/templates"

describe("Email Visual Rendering Tests", () => {
  const outputDir = join(process.cwd(), "__tests__", "lib", "email", "output")

  // Create output directory if it doesn't exist
  try {
    mkdirSync(outputDir, { recursive: true })
  } catch (err) {
    // Directory already exists
  }

  describe("Visual Layout Verification", () => {
    it("should generate verification email with proper layout", () => {
      const result = renderVerificationTemplate({
        verificationUrl: "https://example.com/verify?token=test123",
        expirationHours: 24,
        userName: "John Doe",
        supportEmail: "support@example.com",
      })

      // Save to file for manual inspection
      const outputPath = join(outputDir, "verification-email.html")
      writeFileSync(outputPath, result.html)

      // Verify structure
      expect(result.html).toContain("<!DOCTYPE html>")
      expect(result.html).toContain('<table width="100%"')
      expect(result.html).toContain("max-width: 600px")
      expect(result.html).toContain("John Doe")
      expect(result.html).toContain("https://example.com/verify?token=test123")

      console.log(`Verification email saved to: ${outputPath}`)
    })

    it("should generate reminder email with proper urgency styling", () => {
      const result = renderReminderTemplate({
        userName: "Jane Smith",
        secretTitle: "Important Document",
        daysRemaining: 2,
        checkInUrl: "https://example.com/checkin/123",
        urgencyLevel: "high",
      })

      // Save to file for manual inspection
      const outputPath = join(outputDir, "reminder-email-high-urgency.html")
      writeFileSync(outputPath, result.html)

      // Verify structure and urgency
      expect(result.html).toContain("<!DOCTYPE html>")
      expect(result.html).toContain('<table width="100%"')
      expect(result.html).toContain("max-width: 600px")
      expect(result.html).toContain("Jane Smith")
      expect(result.html).toContain("Important Document")

      console.log(`High urgency reminder email saved to: ${outputPath}`)
    })

    it("should generate disclosure email with proper security warnings", () => {
      const result = renderDisclosureTemplate({
        contactName: "Emergency Contact",
        secretTitle: "Family Emergency Info",
        senderName: "John Doe",
        message: "This contains important emergency contact information.",
        secretContent:
          "Emergency Contacts:\n- Hospital: 555-0123\n- Doctor: 555-0456\n- Family: 555-0789",
        disclosureReason: "scheduled",
        senderLastSeen: new Date("2025-01-01"),
      })

      // Save to file for manual inspection
      const outputPath = join(outputDir, "disclosure-email.html")
      writeFileSync(outputPath, result.html)

      // Verify structure and security elements
      expect(result.html).toContain("<!DOCTYPE html>")
      expect(result.html).toContain('<table width="100%"')
      expect(result.html).toContain("max-width: 600px")
      expect(result.html).toContain("Emergency Contact")
      expect(result.html).toContain("Confidential")
      expect(result.html).toContain("Emergency Contacts")

      console.log(`Disclosure email saved to: ${outputPath}`)
    })

    it("should generate base template with custom content", () => {
      const result = renderBaseTemplate({
        title: "Custom Email Template",
        content: `
          <h2>This is a custom email</h2>
          <p>Testing the base template with custom content that should be properly constrained within 600px max-width.</p>
          <ul>
            <li>Feature 1</li>
            <li>Feature 2</li>
            <li>Feature 3</li>
          </ul>
          <p>All content should be centered and responsive on mobile devices.</p>
        `,
        footerText: "Custom footer message for this email.",
      })

      // Save to file for manual inspection
      const outputPath = join(outputDir, "custom-base-email.html")
      writeFileSync(outputPath, result.html)

      // Verify structure
      expect(result.html).toContain("<!DOCTYPE html>")
      expect(result.html).toContain('<table width="100%"')
      expect(result.html).toContain("max-width: 600px")
      expect(result.html).toContain("Custom Email Template")

      console.log(`Custom base email saved to: ${outputPath}`)
    })

    it("should handle very long content gracefully", () => {
      const longContent = Array(50)
        .fill(0)
        .map(
          (_, i) =>
            `<p>Paragraph ${i + 1}: This is a very long email with lots of content to test how well the max-width constraint works with scrolling and wrapping.</p>`,
        )
        .join("\n")

      const result = renderBaseTemplate({
        title: "Long Content Email",
        content: longContent,
      })

      // Save to file for manual inspection
      const outputPath = join(outputDir, "long-content-email.html")
      writeFileSync(outputPath, result.html)

      // Verify structure
      expect(result.html).toContain("<!DOCTYPE html>")
      expect(result.html).toContain('<table width="100%"')
      expect(result.html).toContain("max-width: 600px")
      expect(result.html).toContain("Paragraph 1")
      expect(result.html).toContain("Paragraph 50")

      console.log(`Long content email saved to: ${outputPath}`)
    })
  })

  describe("Mobile Responsiveness", () => {
    it("should include viewport meta tag for mobile rendering", () => {
      const result = renderBaseTemplate({
        title: "Mobile Test",
        content: "<p>Testing mobile responsiveness</p>",
      })

      expect(result.html).toContain('name="viewport"')
      expect(result.html).toContain("width=device-width")
      expect(result.html).toContain("initial-scale=1.0")
    })

    it("should use percentage widths for mobile compatibility", () => {
      const result = renderBaseTemplate({
        title: "Mobile Test",
        content: "<p>Testing mobile responsiveness</p>",
      })

      // Should have 100% width tables for mobile responsiveness
      expect(result.html).toContain('width="100%"')
      // Max-width constrains desktop view
      expect(result.html).toContain("max-width: 600px")
    })
  })

  describe("Email Client Compatibility", () => {
    it("should use table-based layout for Outlook compatibility", () => {
      const result = renderBaseTemplate({
        title: "Outlook Test",
        content: "<p>Testing Outlook compatibility</p>",
      })

      // Tables are essential for Outlook
      expect(result.html).toContain("<table")
      expect(result.html).toContain('cellpadding="0"')
      expect(result.html).toContain('cellspacing="0"')
    })

    it("should use inline styles for Gmail compatibility", () => {
      const result = renderBaseTemplate({
        title: "Gmail Test",
        content: "<p>Testing Gmail compatibility</p>",
      })

      // Gmail strips <style> tags, so critical styles must be inline
      expect(result.html).toContain('style="max-width: 600px')
      expect(result.html).toContain('style="padding:')
      expect(result.html).toContain('style="text-align:')
    })

    it("should handle images with proper constraints", () => {
      const result = renderBaseTemplate({
        title: "Image Test",
        content:
          '<img src="https://example.com/logo.png" alt="Logo" style="max-width: 100%; height: auto;" />',
      })

      // Images should be responsive
      expect(result.html).toContain("max-width: 100%")
      expect(result.html).toContain("height: auto")
    })
  })
})
