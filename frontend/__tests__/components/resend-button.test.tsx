import { ResendButton } from "@/components/auth/resend-button"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock toast hook
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock fetch
global.fetch = vi.fn()

describe("ResendButton Component", () => {
  const testEmail = "test@example.com"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    ;(global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should render resend button with proper text", () => {
    render(<ResendButton email={testEmail} />)

    const button = screen.getByTestId("resend-verification-button")
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent("Resend verification email")
  })

  it("should show loading state when resending", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email={testEmail} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })

  it("should call default API when no custom onResend provided", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email={testEmail} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    })
  })

  it("should call custom onResend function when provided", async () => {
    const mockOnResend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ResendButton email={testEmail} onResend={mockOnResend} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    expect(mockOnResend).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("should show success toast after successful resend", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email={testEmail} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Email sent",
        description:
          "A new verification email has been sent to your email address.",
      })
    })
  })

  it("should show error toast when API fails", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "Rate limited" }),
    })

    const user = userEvent.setup()
    render(<ResendButton email={testEmail} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Rate limited",
        variant: "destructive",
      })
    })
  })

  it("should implement cooldown period after successful resend", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email={testEmail} cooldownSeconds={60} />)

    const button = screen.getByTestId("resend-verification-button")

    // First click - should work
    await user.click(button)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled()
    })

    // Should show cooldown
    await waitFor(() => {
      expect(screen.getByText(/resend in \d+s/i)).toBeInTheDocument()
      expect(button).toBeDisabled()
    })
  })

  it("should count down cooldown timer correctly", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email={testEmail} cooldownSeconds={3} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText("Resend in 3s")).toBeInTheDocument()
    })

    // Advance timer by 1 second
    vi.advanceTimersByTime(1000)

    await waitFor(() => {
      expect(screen.getByText("Resend in 2s")).toBeInTheDocument()
    })

    // Advance timer by 2 more seconds
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.getByText("Resend verification email")).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })

  it("should be disabled when disabled prop is true", () => {
    render(<ResendButton email={testEmail} disabled={true} />)

    const button = screen.getByTestId("resend-verification-button")
    expect(button).toBeDisabled()
  })

  it("should not allow resend without email", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email="" />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("should apply custom className", () => {
    render(<ResendButton email={testEmail} className="custom-class" />)

    const button = screen.getByTestId("resend-verification-button")
    expect(button).toHaveClass("custom-class")
  })

  it("should handle network errors gracefully", async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error("Network error"))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResendButton email={testEmail} />)

    const button = screen.getByTestId("resend-verification-button")
    await user.click(button)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Network error",
        variant: "destructive",
      })
    })
  })
})

describe.skip("ResendButton (disabled during NextAuth migration)", () => {
  it("placeholder", () => expect(true).toBe(true))
})
