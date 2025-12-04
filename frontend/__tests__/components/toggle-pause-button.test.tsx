import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { TogglePauseButton } from "@/components/toggle-pause-button"
import type { Secret } from "@/types"

// Mock fetch - needs to handle both CSRF token fetch and actual API call
const mockFetch = vi.fn()
global.fetch = mockFetch

function setupFetchMock(apiResponse: any) {
  mockFetch
    // First call: CSRF token fetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
    })
    // Second call: actual API call
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    })
}

const mockSecret: Secret = {
  id: "secret-123",
  title: "Test Secret",
  status: "active",
  userId: "user-123",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  nextCheckIn: new Date("2024-01-31T00:00:00Z"),
  checkInDays: 30,
  serverShare: "encrypted-share",
  recipientName: "John Doe",
  recipientEmail: "john@example.com",
  recipientPhone: "+1234567890",
  recipients: [
    {
      id: "recipient-1",
      secretId: "secret-123",
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
  ],
  contactMethod: "email",
  lastCheckIn: null,
  triggeredAt: null,
  iv: undefined,
  authTag: undefined,
  sssSharesTotal: 3,
  sssThreshold: 2,
}

describe("TogglePauseButton", () => {
  const mockOnToggleSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
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
    // Mock API returns snake_case format
    const apiResponse = {
      id: "secret-123",
      title: "Test Secret",
      status: "paused",
      user_id: "user-123",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      next_check_in: "2024-01-31T00:00:00Z",
      check_in_days: 30,
      server_share: "encrypted-share",
      recipient_name: "John Doe",
      recipient_email: "john@example.com",
      recipient_phone: "+1234567890",
      recipients: [
        {
          id: "recipient-1",
          secret_id: "secret-123",
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
          is_primary: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      contact_method: "email",
      last_check_in: null,
      triggered_at: null,
      iv: null,
      auth_tag: null,
      sss_shares_total: 3,
      sss_threshold: 2,
    }
    setupFetchMock({ secret: apiResponse })

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

    // Should call API (second call after CSRF token)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/secrets/secret-123/toggle-pause",
      expect.objectContaining({
        method: "POST",
      }),
    )

    // Should call success callback with camelCase converted secret
    await waitFor(() => {
      expect(mockOnToggleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "secret-123",
          status: "paused",
          title: "Test Secret",
        }),
      )
    })

    // Should return to normal state
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it("should handle successful resume toggle", async () => {
    // Mock API returns snake_case format
    const apiResponse = {
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
      recipients: [
        {
          id: "recipient-1",
          secret_id: "secret-123",
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
          is_primary: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      contact_method: "email",
      last_check_in: null,
      triggered_at: null,
      iv: null,
      auth_tag: null,
      sss_shares_total: 3,
      sss_threshold: 2,
    }
    setupFetchMock({ secret: apiResponse })

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

    // Should call API (second call after CSRF token)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/secrets/secret-123/toggle-pause",
      expect.objectContaining({
        method: "POST",
      }),
    )

    // Should call success callback with camelCase converted secret
    await waitFor(() => {
      expect(mockOnToggleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "secret-123",
          status: "active",
          title: "Test Secret",
        }),
      )
    })
  })

  it("should handle API error response", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
      })
      .mockRejectedValueOnce(new Error("Network error"))

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
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
      })
      .mockImplementationOnce(
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
      })
      .mockReturnValueOnce(promise)

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

    // Should only call fetch twice (CSRF + API)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Resolve the promise
    await act(async () => {
      resolvePromise!({
        json: () => Promise.resolve({ secret: mockSecret }),
      })
    })
  })
})
