import { SecretCard } from "@/components/secret-card"
import { Secret } from "@/types"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the child components
vi.mock("@/components/check-in-button", () => ({
  CheckInButton: ({ onCheckInSuccess, secretId }: any) => (
    <button
      data-testid="check-in-button"
      onClick={() =>
        onCheckInSuccess?.({
          id: secretId,
          status: "active",
          nextCheckIn: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ),
        })
      }
    >
      Check In
    </button>
  ),
}))

vi.mock("@/components/toggle-pause-button", () => ({
  TogglePauseButton: ({ onToggleSuccess, secret }: any) => (
    <button
      data-testid="toggle-pause-button"
      onClick={() =>
        onToggleSuccess?.({
          ...secret,
          status: secret?.status === "active" ? "paused" : "active",
        })
      }
    >
      {secret?.status === "active" ? "Pause" : "Resume"}
    </button>
  ),
}))

const mockSecret: Secret = {
  id: "123",
  title: "Test Secret",
  recipientName: "John Doe",
  recipientEmail: "john@example.com",
  recipientPhone: "+1234567890",
  status: "active",
  nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  lastCheckIn: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
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
  triggeredAt: null,
}

describe("SecretCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders secret information correctly", () => {
    render(<SecretCard secret={mockSecret} />)

    // Use getAllByText to handle multiple instances (mobile + desktop)
    const titleElements = screen.getAllByText("Test Secret")
    expect(titleElements.length).toBeGreaterThan(0)
    expect(titleElements[0]).toBeInTheDocument()

    expect(screen.getByText("Recipient: John Doe")).toBeInTheDocument()
  })

  it("shows correct status badge for active secret", () => {
    render(<SecretCard secret={mockSecret} />)

    // Use getAllByText to handle multiple status badges (mobile + desktop)
    const statusBadges = screen.getAllByText("Active")
    expect(statusBadges.length).toBeGreaterThan(0)
    expect(statusBadges[0]).toBeInTheDocument()
  })

  it("shows urgent status for secrets due soon", () => {
    const urgentSecret = {
      ...mockSecret,
      nextCheckIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
    }

    render(<SecretCard secret={urgentSecret} />)

    const urgentBadges = screen.getAllByText("Urgent")
    expect(urgentBadges.length).toBeGreaterThan(0)
    expect(urgentBadges[0]).toBeInTheDocument()
  })

  it("shows upcoming status for secrets due in 3-5 days", () => {
    const upcomingSecret = {
      ...mockSecret,
      nextCheckIn: new Date(
        Date.now() + 4 * 24 * 60 * 60 * 1000,
      ), // 4 days from now
    }

    render(<SecretCard secret={upcomingSecret} />)

    const upcomingBadges = screen.getAllByText("Upcoming")
    expect(upcomingBadges.length).toBeGreaterThan(0)
    expect(upcomingBadges[0]).toBeInTheDocument()
  })

  it("shows paused status for paused secrets", () => {
    const pausedSecret = {
      ...mockSecret,
      status: "paused" as const,
    }

    render(<SecretCard secret={pausedSecret} />)

    const pausedBadges = screen.getAllByText("Paused")
    expect(pausedBadges.length).toBeGreaterThan(0)
    expect(pausedBadges[0]).toBeInTheDocument()
  })

  it("shows sent status for triggered secrets", () => {
    const triggeredSecret = {
      ...mockSecret,
      triggeredAt: new Date(),
    }

    render(<SecretCard secret={triggeredSecret} />)

    const sentBadges = screen.getAllByText("Sent")
    expect(sentBadges.length).toBeGreaterThan(0)
    expect(sentBadges[0]).toBeInTheDocument()
  })

  it("shows disabled status when server share is deleted", () => {
    const disabledSecret = {
      ...mockSecret,
      serverShare: null,
    }

    render(<SecretCard secret={disabledSecret} />)

    // For disabled status, there are multiple "Disabled" texts (status badge + timing text)
    const disabledElements = screen.getAllByText("Disabled")
    expect(disabledElements.length).toBeGreaterThan(0)
    expect(disabledElements[0]).toBeInTheDocument()
  })

  it("renders check-in button for active secrets", () => {
    render(<SecretCard secret={mockSecret} />)

    expect(screen.getByTestId("check-in-button")).toBeInTheDocument()
  })

  it("renders toggle pause button for active secrets", () => {
    render(<SecretCard secret={mockSecret} />)

    expect(screen.getByTestId("toggle-pause-button")).toBeInTheDocument()
  })

  it("shows recipient information", () => {
    render(<SecretCard secret={mockSecret} />)

    expect(screen.getByText("Recipient: John Doe")).toBeInTheDocument()
  })

  it("shows edit link", () => {
    render(<SecretCard secret={mockSecret} />)

    const editLink = screen.getByRole("link", { name: /edit/i })
    expect(editLink).toHaveAttribute("href", "/secrets/123/edit")
  })
})
