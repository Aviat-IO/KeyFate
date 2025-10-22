import { describe, it, expect } from "vitest"
import { renderReminderTemplate } from "@/lib/email/templates"

describe("Reminder Type Display", () => {
  const baseData = {
    userName: "Test User",
    secretTitle: "Test Secret",
    daysRemaining: 0.5,
    checkInUrl: "https://test.com/check-in?token=abc",
    urgencyLevel: "high" as const,
  }

  it("should display '50% reminder' as 'halfway to deadline'", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "50_percent",
    })

    expect(result.html).toContain("Reminder: halfway to deadline")
  })

  it("should display '25% reminder' as '75% time elapsed'", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "25_percent",
    })

    expect(result.html).toContain("Reminder: 75% time elapsed")
  })

  it("should display '1_hour' reminder correctly", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "1_hour",
    })

    expect(result.html).toContain("Reminder: 1 hour before deadline")
  })

  it("should display '12_hours' reminder correctly", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "12_hours",
    })

    expect(result.html).toContain("Reminder: 12 hours before deadline")
  })

  it("should not display reminder type when not provided (backwards compatible)", () => {
    const result = renderReminderTemplate(baseData)

    expect(result.html).not.toContain("Reminder:")
  })

  it("should include reminder type in text version", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "50_percent",
    })

    expect(result.text).toContain("halfway to deadline")
  })
})
