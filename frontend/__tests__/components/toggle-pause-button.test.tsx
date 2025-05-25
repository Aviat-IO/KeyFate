import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { TogglePauseButton } from "@/components/toggle-pause-button"
import type { Secret } from "@/types"

// Mock fetch
global.fetch = vi.fn()

const mockSecret: Secret = {
  id: "secret-123",
  title: "Test Secret",
  status: "active",
  user_id: "user-123",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  next_check_in: "2024-01-31T00:00:00Z",
  check_in_days: 30,
  server_share: "encrypted-share",
  recipient_name: "John Doe",
  recipient_email: "john@example.com",
  recipient_phone: "+1234567890",
  reminder_sent: false,
  last_check_in: null,
}

describe("TogglePauseButton", () => {
  const mockOnToggleSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
  })

  it("should render pause button for active secret", () => {
    render(
      <TogglePauseButton
        secretId="secret-123"
        status="active"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    expect(screen.getByText("Pause")).toBeInTheDocument()
    expect(screen.getByRole("button")).not.toBeDisabled()
  })

  it("should render resume button for paused secret", () => {
    render(
      <TogglePauseButton
        secretId="secret-123"
        status="paused"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    expect(screen.getByText("Resume")).toBeInTheDocument()
    expect(screen.getByRole("button")).not.toBeDisabled()
  })

  it("should handle successful pause toggle", async () => {
    const updatedSecret = { ...mockSecret, status: "paused" as const }
    ;(global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ secret: updatedSecret }),
    })

    render(
      <TogglePauseButton
        secretId="secret-123"
        status="active"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText("Pause")).toBeInTheDocument()
      expect(button).toBeDisabled()
    })

    // Should call API
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/secrets/secret-123/toggle-pause",
      {
        method: "POST",
      },
    )

    // Should call success callback
    await waitFor(() => {
      expect(mockOnToggleSuccess).toHaveBeenCalledWith(updatedSecret)
    })

    // Should return to normal state
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it("should handle successful resume toggle", async () => {
    const updatedSecret = { ...mockSecret, status: "active" as const }
    ;(global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ secret: updatedSecret }),
    })

    render(
      <TogglePauseButton
        secretId="secret-123"
        status="paused"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText("Resume")).toBeInTheDocument()
      expect(button).toBeDisabled()
    })

    // Should call API
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/secrets/secret-123/toggle-pause",
      {
        method: "POST",
      },
    )

    // Should call success callback
    await waitFor(() => {
      expect(mockOnToggleSuccess).toHaveBeenCalledWith(updatedSecret)
    })
  })

  it("should handle API error response", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    ;(global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ error: "Failed to toggle pause" }),
    })

    render(
      <TogglePauseButton
        secretId="secret-123"
        status="active"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error toggling pause:",
        expect.any(Error),
      )
    })

    // Should not call success callback
    expect(mockOnToggleSuccess).not.toHaveBeenCalled()

    // Should return to normal state
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })

    consoleSpy.mockRestore()
  })

  it("should handle network error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    ;(global.fetch as any).mockRejectedValue(new Error("Network error"))

    render(
      <TogglePauseButton
        secretId="secret-123"
        status="active"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error toggling pause:",
        expect.any(Error),
      )
    })

    // Should not call success callback
    expect(mockOnToggleSuccess).not.toHaveBeenCalled()

    // Should return to normal state
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })

    consoleSpy.mockRestore()
  })

  it("should show loading spinner when loading", async () => {
    ;(global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    )

    render(
      <TogglePauseButton
        secretId="secret-123"
        status="active"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    // Should show loading state immediately
    expect(button).toBeDisabled()
    expect(screen.getByText("Pause")).toBeInTheDocument()

    // Should show loading spinner (Loader2 component)
    const loader = button.querySelector(".animate-spin")
    expect(loader).toBeInTheDocument()
  })

  it("should prevent multiple clicks while loading", async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    ;(global.fetch as any).mockReturnValue(promise)

    render(
      <TogglePauseButton
        secretId="secret-123"
        status="active"
        onToggleSuccess={mockOnToggleSuccess}
      />,
    )

    const button = screen.getByRole("button")

    // First click
    await act(async () => {
      fireEvent.click(button)
    })
    expect(button).toBeDisabled()

    // Second click should be ignored
    fireEvent.click(button)

    // Should only call fetch once
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Resolve the promise
    await act(async () => {
      resolvePromise!({
        json: () => Promise.resolve({ secret: mockSecret }),
      })
    })
  })
})
