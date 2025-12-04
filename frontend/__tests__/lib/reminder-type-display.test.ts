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

  it("should not display reminder type section (removed as redundant)", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "50_percent",
    })

    // Reminder type info box was removed as it duplicated the yellow banner content
    expect(result.html).not.toContain("Reminder type:")
  })

  it("should display secret title and time remaining in the urgency banner", () => {
    const result = renderReminderTemplate({
      ...baseData,
      reminderType: "12_hours",
    })

    // The yellow/orange urgency banner contains the essential info
    expect(result.html).toContain("Test Secret")
    expect(result.html).toContain("12 hours")
  })

  it("should include check-in button and link", () => {
    const result = renderReminderTemplate(baseData)

    expect(result.html).toContain("Check In Now")
    expect(result.html).toContain("https://test.com/check-in?token=abc")
  })
})
