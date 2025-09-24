/**
 * UI Components Testing for Email Verification
 * Task 1.6: Test all email verification UI components
 *
 * Test Coverage:
 * - OTP Input component
 * - Email Verification Enhanced component
 * - Resend Verification Button
 * - Verification Status components
 * - Accessibility compliance
 * - User interactions
 * - Error states
 */

import { ResendVerificationButton } from "@/components/auth/email-verification"
import { OTPInput } from "@/components/auth/otp-input"
import { VerificationCallback } from "@/components/auth/verification-callback"
import { VerificationStatus } from "@/components/auth/verification-status"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock external dependencies
vi.mock("@/lib/email-verification", () => ({
  resendVerificationEmail: vi.fn(),
  checkEmailVerificationStatus: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockResendVerificationEmail = vi.mocked(
  require("@/lib/email-verification").resendVerificationEmail,
)
const mockCheckEmailVerificationStatus = vi.mocked(
  require("@/lib/email-verification").checkEmailVerificationStatus,
)

describe.skip("Email Verification UI components (disabled during NextAuth migration)", () => {
  it("placeholder", () => expect(true).toBe(true))
})

describe("Email Verification UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("OTP Input Component", () => {
    it("should render 6 input fields", () => {
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")
      expect(inputs).toHaveLength(6)

      inputs.forEach((input, index) => {
        expect(input).toHaveAttribute("aria-label", `Digit ${index + 1}`)
        expect(input).toHaveAttribute("maxLength", "1")
        expect(input).toHaveAttribute("type", "text")
      })
    })

    it("should auto-advance focus when entering digits", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // First input should be focused initially
      expect(inputs[0]).toHaveFocus()

      // Type in first input
      await user.type(inputs[0], "1")
      expect(inputs[1]).toHaveFocus()
      expect(mockOnChange).toHaveBeenCalledWith("1")

      // Type in second input
      await user.type(inputs[1], "2")
      expect(inputs[2]).toHaveFocus()
      expect(mockOnChange).toHaveBeenCalledWith("12")

      // Continue through all inputs
      await user.type(inputs[2], "3")
      await user.type(inputs[3], "4")
      await user.type(inputs[4], "5")
      await user.type(inputs[5], "6")

      expect(mockOnChange).toHaveBeenLastCalledWith("123456")
      expect(mockOnComplete).toHaveBeenCalledWith("123456")
    })

    it("should handle backspace navigation correctly", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // Fill first two inputs
      await user.type(inputs[0], "1")
      await user.type(inputs[1], "2")

      // Should be focused on third input
      expect(inputs[2]).toHaveFocus()

      // Backspace should clear current and go to previous
      await user.keyboard("{Backspace}")
      expect(inputs[1]).toHaveFocus()
      expect(inputs[1]).toHaveValue("")

      // Another backspace should go to first input
      await user.keyboard("{Backspace}")
      expect(inputs[0]).toHaveFocus()
      expect(inputs[0]).toHaveValue("")
    })

    it("should handle arrow key navigation", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // Start at first input
      expect(inputs[0]).toHaveFocus()

      // Arrow right should move focus
      await user.keyboard("{ArrowRight}")
      expect(inputs[1]).toHaveFocus()

      // Arrow left should move back
      await user.keyboard("{ArrowLeft}")
      expect(inputs[0]).toHaveFocus()

      // Arrow left at first input should stay
      await user.keyboard("{ArrowLeft}")
      expect(inputs[0]).toHaveFocus()

      // Navigate to last input and test right boundary
      inputs[5].focus()
      await user.keyboard("{ArrowRight}")
      expect(inputs[5]).toHaveFocus()
    })

    it("should handle paste operations correctly", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // Focus first input and paste 6-digit code
      inputs[0].focus()
      await user.paste("123456")

      // All inputs should be filled
      expect(inputs[0]).toHaveValue("1")
      expect(inputs[1]).toHaveValue("2")
      expect(inputs[2]).toHaveValue("3")
      expect(inputs[3]).toHaveValue("4")
      expect(inputs[4]).toHaveValue("5")
      expect(inputs[5]).toHaveValue("6")

      expect(mockOnComplete).toHaveBeenCalledWith("123456")
    })

    it("should filter out non-numeric characters", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // Try typing letters and symbols
      await user.type(inputs[0], "a")
      expect(inputs[0]).toHaveValue("")
      expect(inputs[0]).toHaveFocus() // Should not advance

      await user.type(inputs[0], "!")
      expect(inputs[0]).toHaveValue("")

      // Should accept numbers
      await user.type(inputs[0], "1")
      expect(inputs[0]).toHaveValue("1")
      expect(inputs[1]).toHaveFocus()
    })

    it("should be disabled when disabled prop is true", () => {
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(
        <OTPInput
          onComplete={mockOnComplete}
          onChange={mockOnChange}
          disabled={true}
        />,
      )

      const inputs = screen.getAllByRole("textbox")
      inputs.forEach((input) => {
        expect(input).toBeDisabled()
      })
    })

    it("should clear all inputs when clear method is called", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      const { rerender } = render(
        <OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />,
      )

      const inputs = screen.getAllByRole("textbox")

      // Fill inputs
      await user.type(inputs[0], "1")
      await user.type(inputs[1], "2")
      await user.type(inputs[2], "3")

      // Rerender with reset trigger (implementation detail)
      rerender(
        <OTPInput
          onComplete={mockOnComplete}
          onChange={mockOnChange}
          key="reset" // Force remount
        />,
      )

      // All inputs should be empty
      const newInputs = screen.getAllByRole("textbox")
      newInputs.forEach((input) => {
        expect(input).toHaveValue("")
      })
    })
  })

  describe("Resend Verification Button", () => {
    it("should render with default state", () => {
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      render(
        <ResendVerificationButton
          email="test@example.com"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />,
      )

      const button = screen.getByRole("button", { name: /resend/i })
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
      expect(button).toHaveTextContent("Resend verification email")
    })

    it("should initiate resend process when clicked", async () => {
      const user = userEvent.setup()
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      mockResendVerificationEmail.mockResolvedValue({
        success: true,
      })

      render(
        <ResendVerificationButton
          email="test@example.com"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />,
      )

      const button = screen.getByRole("button", { name: /resend/i })
      await user.click(button)

      expect(mockResendVerificationEmail).toHaveBeenCalledWith(
        "test@example.com",
      )
      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it("should show loading state during resend", async () => {
      const user = userEvent.setup()
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      // Mock slow response
      mockResendVerificationEmail.mockReturnValue(
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 100),
        ),
      )

      render(
        <ResendVerificationButton
          email="test@example.com"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />,
      )

      const button = screen.getByRole("button", { name: /resend/i })
      await user.click(button)

      // Should show loading state
      expect(button).toBeDisabled()
      expect(screen.getByText(/sending/i)).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })

    it("should show cooldown timer after successful send", async () => {
      const user = userEvent.setup()
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      mockResendVerificationEmail.mockResolvedValue({
        success: true,
      })

      render(
        <ResendVerificationButton
          email="test@example.com"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          cooldownSeconds={60}
        />,
      )

      const button = screen.getByRole("button", { name: /resend/i })
      await user.click(button)

      await waitFor(() => {
        expect(button).toBeDisabled()
        expect(button.textContent).toMatch(/\d+s/)
      })
    })

    it("should handle resend errors gracefully", async () => {
      const user = userEvent.setup()
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      mockResendVerificationEmail.mockResolvedValue({
        success: false,
        error: "Rate limit exceeded",
      })

      render(
        <ResendVerificationButton
          email="test@example.com"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />,
      )

      const button = screen.getByRole("button", { name: /resend/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith("Rate limit exceeded")
      })

      // Button should be re-enabled
      expect(button).not.toBeDisabled()
    })

    it("should handle network errors", async () => {
      const user = userEvent.setup()
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      mockResendVerificationEmail.mockRejectedValue(new Error("Network error"))

      render(
        <ResendVerificationButton
          email="test@example.com"
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />,
      )

      const button = screen.getByRole("button", { name: /resend/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Network error. Please try again.",
        )
      })
    })
  })

  describe("Verification Status Component", () => {
    it("should show loading state initially", () => {
      mockCheckEmailVerificationStatus.mockReturnValue(
        new Promise(() => {}), // Never resolves
      )

      render(<VerificationStatus email="test@example.com" />)

      expect(
        screen.getByText(/checking verification status/i),
      ).toBeInTheDocument()
      expect(screen.getByRole("progressbar")).toBeInTheDocument()
    })

    it("should show verified status when email is verified", async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: true,
        user: {
          id: "user-id",
          email: "test@example.com",
          email_verified: true,
        },
      })

      render(<VerificationStatus email="test@example.com" />)

      await waitFor(() => {
        expect(screen.getByText(/email verified/i)).toBeInTheDocument()
        expect(screen.getByTestId("check-icon")).toBeInTheDocument()
      })
    })

    it("should show unverified status when email is not verified", async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: {
          id: "user-id",
          email: "test@example.com",
          email_verified: false,
        },
      })

      render(<VerificationStatus email="test@example.com" />)

      await waitFor(() => {
        expect(screen.getByText(/email not verified/i)).toBeInTheDocument()
        expect(screen.getByTestId("warning-icon")).toBeInTheDocument()
      })
    })

    it("should handle errors gracefully", async () => {
      mockCheckEmailVerificationStatus.mockRejectedValue(
        new Error("Status check failed"),
      )

      render(<VerificationStatus email="test@example.com" />)

      await waitFor(() => {
        expect(screen.getByText(/error checking status/i)).toBeInTheDocument()
        expect(screen.getByTestId("error-icon")).toBeInTheDocument()
      })
    })

    it("should refresh status when email changes", async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const { rerender } = render(
        <VerificationStatus email="test1@example.com" />,
      )

      await waitFor(() => {
        expect(screen.getByText(/email not verified/i)).toBeInTheDocument()
      })

      expect(mockCheckEmailVerificationStatus).toHaveBeenCalledWith(
        "test1@example.com",
      )

      // Change email
      rerender(<VerificationStatus email="test2@example.com" />)

      await waitFor(() => {
        expect(mockCheckEmailVerificationStatus).toHaveBeenCalledWith(
          "test2@example.com",
        )
      })
    })
  })

  describe("Verification Callback Component", () => {
    it("should extract token from URL and attempt verification", async () => {
      // Mock successful verification
      const mockVerifyToken = vi.fn().mockResolvedValue({
        success: true,
        verified: true,
      })

      render(
        <VerificationCallback
          token="verification-token-123"
          email="test@example.com"
          onVerificationComplete={mockVerifyToken}
        />,
      )

      expect(screen.getByText(/verifying your email/i)).toBeInTheDocument()

      await waitFor(() => {
        expect(mockVerifyToken).toHaveBeenCalledWith({
          email: "test@example.com",
          token: "verification-token-123",
        })
      })
    })

    it("should show success state after successful verification", async () => {
      const mockVerifyToken = vi.fn().mockResolvedValue({
        success: true,
        verified: true,
      })

      render(
        <VerificationCallback
          token="verification-token-123"
          email="test@example.com"
          onVerificationComplete={mockVerifyToken}
        />,
      )

      await waitFor(() => {
        expect(
          screen.getByText(/email verified successfully/i),
        ).toBeInTheDocument()
        expect(screen.getByTestId("success-icon")).toBeInTheDocument()
      })
    })

    it("should show error state for invalid token", async () => {
      const mockVerifyToken = vi.fn().mockResolvedValue({
        success: false,
        error: "Invalid verification token",
      })

      render(
        <VerificationCallback
          token="invalid-token"
          email="test@example.com"
          onVerificationComplete={mockVerifyToken}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
        expect(
          screen.getByText(/invalid verification token/i),
        ).toBeInTheDocument()
        expect(screen.getByTestId("error-icon")).toBeInTheDocument()
      })
    })

    it("should show expired token message", async () => {
      const mockVerifyToken = vi.fn().mockResolvedValue({
        success: false,
        error: "Verification token has expired",
      })

      render(
        <VerificationCallback
          token="expired-token"
          email="test@example.com"
          onVerificationComplete={mockVerifyToken}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: /request new verification/i }),
        ).toBeInTheDocument()
      })
    })

    it("should handle network errors", async () => {
      const mockVerifyToken = vi
        .fn()
        .mockRejectedValue(new Error("Network error"))

      render(
        <VerificationCallback
          token="some-token"
          email="test@example.com"
          onVerificationComplete={mockVerifyToken}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: /retry verification/i }),
        ).toBeInTheDocument()
      })
    })
  })

  describe("Accessibility Compliance", () => {
    it("should have proper ARIA labels and roles", () => {
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")
      inputs.forEach((input, index) => {
        expect(input).toHaveAttribute("aria-label", `Digit ${index + 1}`)
        expect(input).toHaveAttribute("aria-describedby")
      })

      // Check for form labels
      expect(screen.getByText(/enter verification code/i)).toBeInTheDocument()
    })

    it("should support screen reader announcements", async () => {
      const user = userEvent.setup()
      const mockOnComplete = vi.fn()
      const mockOnChange = vi.fn()

      render(
        <div>
          <div role="status" aria-live="polite" id="otp-status">
            Enter 6-digit verification code
          </div>
          <OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />
        </div>,
      )

      const inputs = screen.getAllByRole("textbox")

      // Type complete code
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], (i + 1).toString())
      }

      expect(mockOnComplete).toHaveBeenCalledWith("123456")

      // Status region should be updated (implementation dependent)
      const statusRegion = screen.getByRole("status")
      expect(statusRegion).toBeInTheDocument()
    })

    it("should have proper color contrast for error states", async () => {
      const mockVerifyToken = vi.fn().mockResolvedValue({
        success: false,
        error: "Invalid verification token",
      })

      render(
        <VerificationCallback
          token="invalid-token"
          email="test@example.com"
          onVerificationComplete={mockVerifyToken}
        />,
      )

      await waitFor(() => {
        const errorMessage = screen.getByText(/invalid verification token/i)
        expect(errorMessage).toBeInTheDocument()

        // Error text should have proper styling
        expect(errorMessage).toHaveClass(/text-red|text-destructive|error/)
      })
    })

    it("should support keyboard navigation for all interactive elements", async () => {
      const user = userEvent.setup()
      const mockOnSuccess = vi.fn()
      const mockOnError = vi.fn()

      mockResendVerificationEmail.mockResolvedValue({
        success: true,
      })

      render(
        <div>
          <OTPInput onComplete={vi.fn()} onChange={vi.fn()} />
          <ResendVerificationButton
            email="test@example.com"
            onSuccess={mockOnSuccess}
            onError={mockOnError}
          />
        </div>,
      )

      // Tab through inputs
      const inputs = screen.getAllByRole("textbox")
      const button = screen.getByRole("button", { name: /resend/i })

      await user.tab()
      expect(inputs[0]).toHaveFocus()

      // Tab through all inputs
      for (let i = 1; i < inputs.length; i++) {
        await user.tab()
        expect(inputs[i]).toHaveFocus()
      }

      // Tab to button
      await user.tab()
      expect(button).toHaveFocus()

      // Activate button with Enter
      await user.keyboard("{Enter}")
      expect(mockResendVerificationEmail).toHaveBeenCalled()
    })
  })
})
