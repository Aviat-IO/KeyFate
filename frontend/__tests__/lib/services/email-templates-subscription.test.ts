/**
 * @jest-environment node
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { emailTemplates } from "@/lib/services/email-templates"

describe("Subscription Email Templates", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("subscriptionConfirmation", () => {
    const baseParams = {
      userName: "John Doe",
      tierName: "pro" as const,
      provider: "stripe" as const,
      amount: 900, // cents
      interval: "month",
      nextBillingDate: new Date("2025-02-11"),
    }

    describe("NEXT_PUBLIC_COMPANY environment variable", () => {
      it("should use NEXT_PUBLIC_COMPANY in subject when set", () => {
        process.env.NEXT_PUBLIC_COMPANY = "MyCompany"

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.subject).toBe("Subscription Confirmed - MyCompany")
      })

      it("should use NEXT_PUBLIC_COMPANY in HTML body when set", () => {
        process.env.NEXT_PUBLIC_COMPANY = "MyCompany"

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain(
          "Thank you for subscribing to <strong>MyCompany Pro</strong>",
        )
        expect(result.html).toContain("MyCompany - Secure Secret Management")
      })

      it("should use NEXT_PUBLIC_COMPANY in text body when set", () => {
        process.env.NEXT_PUBLIC_COMPANY = "MyCompany"

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.text).toContain("Subscription Confirmed - MyCompany")
        expect(result.text).toContain(
          "Thank you for subscribing to MyCompany Pro",
        )
        expect(result.text).toContain("MyCompany - Secure Secret Management")
      })

      it("should default to KeyFate when NEXT_PUBLIC_COMPANY is not set", () => {
        delete process.env.NEXT_PUBLIC_COMPANY

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.subject).toBe("Subscription Confirmed - KeyFate")
        expect(result.html).toContain(
          "Thank you for subscribing to <strong>KeyFate Pro</strong>",
        )
        expect(result.html).toContain("KeyFate - Secure Secret Management")
        expect(result.text).toContain("Subscription Confirmed - KeyFate")
      })

      it("should handle empty NEXT_PUBLIC_COMPANY by using default", () => {
        process.env.NEXT_PUBLIC_COMPANY = ""

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.subject).toBe("Subscription Confirmed - KeyFate")
      })
    })

    describe("NEXT_PUBLIC_SUPPORT_EMAIL environment variable", () => {
      it("should use NEXT_PUBLIC_SUPPORT_EMAIL when set", () => {
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@mycompany.com"

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain("help@mycompany.com")
        expect(result.text).toContain("help@mycompany.com")
      })

      it("should default to support@keyfate.com when not set", () => {
        delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain("support@keyfate.com")
        expect(result.text).toContain("support@keyfate.com")
      })
    })

    describe("brand styling", () => {
      it("should use primary brand color in header", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain(
          "background: hsl(13.2143 73.0435% 54.9020%)",
        )
      })

      it("should use primary brand color in button", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain(
          "background: hsl(13.2143 73.0435% 54.9020%)",
        )
        expect(result.html).toContain("color: white !important")
      })

      it("should have white text color on button with inline style", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toMatch(/color:\s*white/i)
      })
    })

    describe("pricing display", () => {
      it("should format cents correctly for monthly subscription", () => {
        const result = emailTemplates.subscriptionConfirmation({
          ...baseParams,
          amount: 900,
          interval: "month",
        })

        expect(result.html).toContain("$9.00/month")
        expect(result.text).toContain("$9.00/month")
      })

      it("should format cents correctly for annual subscription", () => {
        const result = emailTemplates.subscriptionConfirmation({
          ...baseParams,
          amount: 9000,
          interval: "year",
        })

        expect(result.html).toContain("$90.00/year")
        expect(result.text).toContain("$90.00/year")
      })
    })

    describe("tier features", () => {
      it("should pull features from tier config", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        // These features come from TIER_CONFIGS.pro.features
        expect(result.html).toContain("Up to 10 secrets")
        expect(result.html).toContain("Up to 5 recipients per secret")
        expect(result.html).toContain(
          "Configurable security (2-of-N up to 7 shares)",
        )
        expect(result.html).toContain("Message templates for common scenarios")
        expect(result.html).toContain("Comprehensive audit logs")
      })

      it("should show support email in features list", () => {
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@test.com"

        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain("Priority email support (help@test.com)")
      })
    })

    describe("provider names", () => {
      it("should display Credit Card for stripe provider", () => {
        const result = emailTemplates.subscriptionConfirmation({
          ...baseParams,
          provider: "stripe",
        })

        expect(result.html).toContain("Credit Card")
        expect(result.text).toContain("Credit Card")
      })

      it("should display Bitcoin for btcpay provider", () => {
        const result = emailTemplates.subscriptionConfirmation({
          ...baseParams,
          provider: "btcpay",
        })

        expect(result.html).toContain("Bitcoin")
        expect(result.text).toContain("Bitcoin")
      })
    })

    describe("email structure", () => {
      it("should include all required sections in HTML", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain("<!DOCTYPE html>")
        expect(result.html).toContain('<meta name="viewport"')
        expect(result.html).toContain("Subscription Confirmed")
        expect(result.html).toContain("Hello John Doe!")
        expect(result.html).toContain("Subscription Details")
        expect(result.html).toContain("Access Your Dashboard")
      })

      it("should have proper max-width for email clients", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.html).toContain("max-width: 600px")
      })

      it("should include plain text version", () => {
        const result = emailTemplates.subscriptionConfirmation(baseParams)

        expect(result.text).toContain("Hello John Doe!")
        expect(result.text).toContain("Subscription Details")
        expect(result.text).toContain("Plan: Pro")
      })
    })
  })
})
