import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SecretCard } from "@/components/secret-card"
import { Secret } from "@/types"

// Mock the child components
vi.mock("@/components/check-in-button", () => ({
  CheckInButton: ({ onCheckInSuccess, secretId }: any) => (
    <button
      data-testid="check-in-button"
      onClick={() =>
        onCheckInSuccess?.({
          id: secretId,
          status: "active",
          next_check_in: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
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
  recipient_name: "John Doe",
  recipient_email: "john@example.com",
  recipient_phone: "+1234567890",
  status: "active",
  next_check_in: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  last_check_in: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  is_triggered: false,
  server_share: "encrypted-share-data",
  user_id: "user-123",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  check_in_interval_days: 7,
  encrypted_message: "encrypted-message",
  reminder_days_before: 2,
}

describe("SecretCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders secret information correctly", () => {
    render(<SecretCard secret={mockSecret} />)

    expect(screen.getByText("Test Secret")).toBeInTheDocument()
    expect(screen.getByText("Recipient: John Doe")).toBeInTheDocument()
  })

  it("shows correct status badge for active secret", () => {
    render(<SecretCard secret={mockSecret} />)

    expect(screen.getByText("Checked in")).toBeInTheDocument()
  })

  it("shows urgent status for secrets due soon", () => {
    const urgentSecret = {
      ...mockSecret,
      next_check_in: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    }

    render(<SecretCard secret={urgentSecret} />)

    expect(screen.getByText("Urgent")).toBeInTheDocument()
  })

  it("shows upcoming status for secrets due in 3-5 days", () => {
    const upcomingSecret = {
      ...mockSecret,
      next_check_in: new Date(
        Date.now() + 4 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 4 days from now
    }

    render(<SecretCard secret={upcomingSecret} />)

    expect(screen.getByText("Upcoming")).toBeInTheDocument()
  })

  it("shows paused status for paused secrets", () => {
    const pausedSecret = {
      ...mockSecret,
      status: "paused" as const,
    }

    render(<SecretCard secret={pausedSecret} />)

    expect(screen.getByText("Paused")).toBeInTheDocument()
  })

  it("shows sent status for triggered secrets", () => {
    const triggeredSecret = {
      ...mockSecret,
      is_triggered: true,
    }

    render(<SecretCard secret={triggeredSecret} />)

    expect(screen.getByText("Sent")).toBeInTheDocument()
  })

  it("shows disabled status when server share is deleted", () => {
    const disabledSecret = {
      ...mockSecret,
      server_share: null,
    }

    render(<SecretCard secret={disabledSecret} />)

    expect(screen.getByText("Disabled")).toBeInTheDocument()
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

  it("applies correct styling for triggered secrets", () => {
    const triggeredSecret = {
      ...mockSecret,
      is_triggered: true,
    }

    const { container } = render(<SecretCard secret={triggeredSecret} />)

    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass("border-destructive/50", "bg-destructive/5")
  })

  it("applies correct styling for paused secrets", () => {
    const pausedSecret = {
      ...mockSecret,
      status: "paused" as const,
    }

    const { container } = render(<SecretCard secret={pausedSecret} />)

    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass("border-muted", "bg-muted/5")
  })

  it("shows edit link", () => {
    render(<SecretCard secret={mockSecret} />)

    const editLink = screen.getByRole("link", { name: /edit/i })
    expect(editLink).toHaveAttribute("href", "/secrets/123/edit")
  })
})
