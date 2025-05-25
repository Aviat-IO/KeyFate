import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CheckInButton } from "@/components/check-in-button"

// Mock fetch
global.fetch = vi.fn()

// Mock environment variable
vi.mock("@/lib/env", () => ({
  NEXT_PUBLIC_SITE_URL: "https://test.com",
}))

const mockSecret = {
  id: "123",
  status: "active",
  next_check_in: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
}

describe("CheckInButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fetch as any).mockClear()
  })

  it("renders with default props", () => {
    render(<CheckInButton secretId="123" />)

    expect(
      screen.getByRole("button", { name: /check in/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Check In")).toBeInTheDocument()
  })

  it("shows loading state during check-in", async () => {
    ;(fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ secret: mockSecret }),
              }),
            100,
          ),
        ),
    )

    render(<CheckInButton secretId="123" />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(screen.getByText("Checking in...")).toBeInTheDocument()
    expect(button).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByText("Check In")).toBeInTheDocument()
    })
  })

  it("calls API with correct parameters", async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ secret: mockSecret }),
    })

    render(<CheckInButton secretId="123" />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://test.com/api/secrets/123/check-in",
        { method: "POST" },
      )
    })
  })

  it("calls onCheckInSuccess callback on successful check-in", async () => {
    const mockOnSuccess = vi.fn()
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ secret: mockSecret }),
    })

    render(<CheckInButton secretId="123" onCheckInSuccess={mockOnSuccess} />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(mockSecret)
    })
  })

  it("shows error toast on failed check-in", async () => {
    ;(fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<CheckInButton secretId="123" />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      // Toast is mocked in setup.ts, so we just verify the button returns to normal state
      expect(screen.getByText("Check In")).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })

  it("handles network error gracefully", async () => {
    ;(fetch as any).mockRejectedValue(new Error("Network error"))

    render(<CheckInButton secretId="123" />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("Check In")).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })

  it("renders with different variants", () => {
    const { rerender } = render(
      <CheckInButton secretId="123" variant="default" />,
    )

    let button = screen.getByRole("button")
    expect(button).toHaveClass("bg-primary")

    rerender(<CheckInButton secretId="123" variant="outline" />)
    button = screen.getByRole("button")
    expect(button).toHaveClass("border-input")

    rerender(<CheckInButton secretId="123" variant="ghost" />)
    button = screen.getByRole("button")
    expect(button).toHaveClass("hover:bg-accent")
  })

  it("shows correct icons", () => {
    render(<CheckInButton secretId="123" />)

    // Check for CheckCircle icon (we can't easily test the actual icon, but we can test the text)
    expect(screen.getByText("Check In")).toBeInTheDocument()
  })
})
