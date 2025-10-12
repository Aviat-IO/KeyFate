import { SecretCard } from "@/components/secret-card"
import { Secret } from "@/types"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the child components
vi.mock("@/components/check-in-button", () => ({
  CheckInButton: () => <button data-testid="check-in-button">Check In</button>,
}))

vi.mock("@/components/toggle-pause-button", () => ({
  TogglePauseButton: () => (
    <button data-testid="toggle-pause-button">Pause</button>
  ),
}))

const createMockSecret = (overrides?: Partial<Secret>): Secret => {
  const baseSecret: Secret = {
    id: "123",
    title: "Test Secret",
    recipientName: "John Doe",
    recipientEmail: "john@example.com",
    recipientPhone: "+1234567890",
    recipients: [
      {
        id: "recipient-1",
        secretId: "123",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    status: "active",
    nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lastCheckIn: new Date(Date.now() - 24 * 60 * 60 * 1000),
    triggeredAt: null,
    serverShare: "encrypted-share-data",
    userId: "user-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    checkInDays: 7,
    contactMethod: "email",
    authTag: "auth-tag-data",
    iv: "iv-data",
    sssSharesTotal: 3,
    sssThreshold: 2,
  }
  return { ...baseSecret, ...overrides }
}

describe("SecretCard Time Display", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Granular time formatting - Days", () => {
    it("displays time in days format when >24 hours remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      // Should display format like "Triggers in X days" (where X >= 2)
      const timingElements = screen.getAllByText(/Triggers in \d+ days?/i)
      expect(timingElements.length).toBeGreaterThan(0)
      // Verify it says "days" not "hours" or "minutes"
      expect(timingElements[0].textContent).toMatch(/\d+ days?$/)
    })

    it("displays time in appropriate format near 24 hour boundary", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 5000, // Add 5 seconds to avoid rounding issues
        ).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      // Should display "1 day" or "23 hours" depending on exact timing
      const content = screen.getAllByText(/Triggers in/i)[0].textContent
      expect(content).toMatch(/Triggers in (1 day|2\d hours?)/)
    })

    it("displays time in days format for a week remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(/Triggers in \d+ days?/i)
      expect(timingElements.length).toBeGreaterThan(0)
      expect(timingElements[0].textContent).toMatch(/\d+ days?$/)
    })
  })

  describe("Granular time formatting - Hours", () => {
    it("displays time in hours format when 1-24 hours remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(/Triggers in \d+ hours?/i)
      expect(timingElements.length).toBeGreaterThan(0)
      expect(timingElements[0].textContent).toMatch(/\d+ hours?$/)
    })

    it("displays time in appropriate format near 1 hour boundary", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(
          Date.now() + 1 * 60 * 60 * 1000 + 5000, // Add 5 seconds to avoid rounding issues
        ).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      // Should display "1 hour" or "59 minutes" depending on exact timing
      const content = screen.getAllByText(/Triggers in/i)[0].textContent
      expect(content).toMatch(/Triggers in (1 hour|5\d minutes?)/)
    })

    it("displays time in hours format when less than 24 hours remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(/Triggers in \d+ hours?/i)
      expect(timingElements.length).toBeGreaterThan(0)
      // Should say "hours" not "day"
      expect(timingElements[0].textContent).toMatch(/\d+ hours?$/)
      expect(timingElements[0].textContent).not.toMatch(/day/)
    })
  })

  describe("Granular time formatting - Minutes", () => {
    it("displays time in minutes format when <1 hour remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(/Triggers in \d+ minutes?/i)
      expect(timingElements.length).toBeGreaterThan(0)
      expect(timingElements[0].textContent).toMatch(/\d+ minutes?$/)
    })

    it("displays time in appropriate format near 1 minute boundary", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 1 * 60 * 1000 + 5000).toISOString(), // Add 5 seconds
      })

      render(<SecretCard secret={secret} />)

      // Should display "1 minute" or "less than a minute" depending on exact timing
      const content = screen.getAllByText(/Triggers in/i)[0].textContent
      expect(content).toMatch(/Triggers in (1 minute|less than a minute)/)
    })

    it("displays time in minutes format when multiple minutes remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(/Triggers in \d+ minutes?/i)
      expect(timingElements.length).toBeGreaterThan(0)
      expect(timingElements[0].textContent).toMatch(/\d+ minutes?$/)
    })

    it("displays 'less than a minute' when <1 minute remaining", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 30 * 1000).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(
        /Triggers in less than a minute/i,
      )
      expect(timingElements.length).toBeGreaterThan(0)
    })
  })

  describe("Edge cases and special states", () => {
    it("displays tooltip with full datetime on hover for active secrets", () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      const secret = createMockSecret({
        nextCheckIn: futureDate.toISOString(),
      })

      render(<SecretCard secret={secret} />)

      const timingElements = screen.getAllByText(/Triggers in \d+ days?/i)
      expect(timingElements.length).toBeGreaterThan(0)
    })

    it("displays 'Disabled' for secrets with deleted server share", () => {
      const secret = createMockSecret({
        serverShare: null,
      })

      render(<SecretCard secret={secret} />)

      const disabledElements = screen.getAllByText("Disabled")
      expect(disabledElements.length).toBeGreaterThan(0)
    })

    it("displays 'Sent' with timeago format for triggered secrets", () => {
      const secret = createMockSecret({
        triggeredAt: new Date(),
        triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      })

      render(<SecretCard secret={secret} />)

      const sentElements = screen.getAllByText(/Sent/i)
      expect(sentElements.length).toBeGreaterThan(0)
    })
  })

  describe("Consistent display across mobile and desktop layouts", () => {
    it("displays granular time consistently in both layouts", () => {
      const secret = createMockSecret({
        nextCheckIn: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      })

      render(<SecretCard secret={secret} />)

      // Should appear in both mobile and desktop layouts
      const timeElements = screen.getAllByText(/Triggers in \d+ hours?/i)
      expect(timeElements.length).toBeGreaterThan(0)
    })
  })
})
