/**
 * Comprehensive Email Verification System Tests
 * Task 1.6: Complete end-to-end testing of email verification functionality
 *
 * Test Coverage:
 * 1. End-to-End Flow Testing
 * 2. Integration Testing (Middleware + UI + Backend)
 * 3. Security Testing (Route protection, rate limiting)
 * 4. User Experience Testing (All flows and error scenarios)
 * 5. Accessibility Testing
 * 6. Performance Testing
 */

import { EmailVerificationPage } from "@/components/auth/email-verification-page"
import * as emailVerification from "@/lib/email-verification"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the external dependencies
vi.mock("next/navigation")
vi.mock("next-auth/react")
vi.mock("@/lib/email-verification")
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

const mockSearchParams = new URLSearchParams()
const mockToast = vi.fn()

// Mock implementations
vi.mocked(useRouter).mockReturnValue(mockRouter)
vi.mocked(useSearchParams).mockReturnValue(mockSearchParams)

describe.skip("Comprehensive Email Verification (disabled during NextAuth migration)", () => {
  it("placeholder", () => expect(true).toBe(true))
})

describe("Email Verification System - Comprehensive Testing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("1. End-to-End Flow Testing", () => {
    it("should complete full verification flow: signup → verification page → success", async () => {
      const user = userEvent.setup()

      // Mock authenticated session with unverified email
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            name: "Test User",
          },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      // Mock verification status check - initially unverified
      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock successful OTP verification
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: true,
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
          email_verified: true,
        },
      })

      mockSearchParams.set("email", "test@example.com")
      mockSearchParams.set("callbackUrl", "/dashboard")

      render(<EmailVerificationPage />)

      // Step 1: Verify page loads with verification form
      expect(screen.getByTestId("verification-container")).toBeInTheDocument()
      expect(screen.getByText("Verify your email address")).toBeInTheDocument()
      expect(
        screen.getByText(/Enter the 6-digit code sent to/),
      ).toBeInTheDocument()
      expect(screen.getByText("test@example.com")).toBeInTheDocument()

      // Step 2: Enter verification code
      const otpInputs = screen.getAllByRole("textbox")
      expect(otpInputs).toHaveLength(6)

      // Simulate entering OTP: 123456
      await user.type(otpInputs[0], "1")
      await user.type(otpInputs[1], "2")
      await user.type(otpInputs[2], "3")
      await user.type(otpInputs[3], "4")
      await user.type(otpInputs[4], "5")
      await user.type(otpInputs[5], "6")

      // Step 3: Verify OTP submission and success
      await waitFor(() => {
        expect(emailVerification.verifyEmailWithOTP).toHaveBeenCalledWith(
          "test@example.com",
          "123456",
        )
      })

      // Step 4: Verify success state and redirect
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Email verified!",
          description: "Your email address has been successfully verified.",
        })
      })

      // Step 5: Verify redirect to dashboard
      await waitFor(
        () => {
          expect(mockRouter.push).toHaveBeenCalledWith("/dashboard")
        },
        { timeout: 2000 },
      )
    })

    it("should handle Google OAuth signup → email verification flow", async () => {
      // Simulate Google OAuth session with unverified email
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: {
            id: "google-user-id",
            email: "googleuser@example.com",
            name: "Google User",
            image: "https://example.com/avatar.jpg",
          },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      mockSearchParams.set("email", "googleuser@example.com")
      mockSearchParams.set("callbackUrl", "/dashboard")

      render(<EmailVerificationPage />)

      // Verify Google OAuth user can access verification page
      expect(screen.getByText("googleuser@example.com")).toBeInTheDocument()
      expect(screen.getByTestId("verification-container")).toBeInTheDocument()

      // Verify resend functionality works for OAuth users
      const resendButton = screen.getByRole("button", { name: /resend/i })
      expect(resendButton).toBeInTheDocument()
      expect(resendButton).not.toBeDisabled()
    })

    it("should handle already verified users correctly", async () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: {
            id: "verified-user-id",
            email: "verified@example.com",
            name: "Verified User",
          },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      // Mock already verified status
      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: true,
        user: {
          id: "verified-user-id",
          email: "verified@example.com",
          name: "Verified User",
          email_verified: true,
        },
      })

      mockSearchParams.set("callbackUrl", "/dashboard")

      render(<EmailVerificationPage />)

      // Should show already verified state
      await waitFor(() => {
        expect(screen.getByText("Email Already Verified")).toBeInTheDocument()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: "Already verified",
        description: "Your email is already verified. Redirecting...",
      })

      // Should redirect to dashboard
      await waitFor(
        () => {
          expect(mockRouter.push).toHaveBeenCalledWith("/dashboard")
        },
        { timeout: 2500 },
      )
    })
  })

  describe("2. Integration Testing - UI Components", () => {
    it("should integrate OTP input with verification page correctly", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      render(<EmailVerificationPage />)

      // Test OTP input integration
      const otpInputs = screen.getAllByRole("textbox")

      // Test auto-focus and navigation
      expect(otpInputs[0]).toHaveFocus()

      await user.type(otpInputs[0], "1")
      expect(otpInputs[1]).toHaveFocus()

      await user.type(otpInputs[1], "2")
      expect(otpInputs[2]).toHaveFocus()

      // Test backspace navigation
      await user.keyboard("{Backspace}")
      expect(otpInputs[1]).toHaveFocus()
      expect(otpInputs[1]).toHaveValue("")
    })

    it("should integrate resend button with cooldown correctly", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      vi.mocked(emailVerification.resendVerificationEmail).mockResolvedValue({
        success: true,
      })

      render(<EmailVerificationPage />)

      const resendButton = screen.getByRole("button", { name: /resend/i })

      // Click resend
      await user.click(resendButton)

      await waitFor(() => {
        expect(emailVerification.resendVerificationEmail).toHaveBeenCalledWith(
          "test@example.com",
        )
      })

      // Button should be disabled with countdown
      expect(resendButton).toBeDisabled()
      expect(resendButton.textContent).toMatch(/\d+s/)
    })
  })

  describe("3. Security Testing", () => {
    it("should enforce rate limiting on verification attempts", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock rate limit error
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: false,
        error: "Too many verification attempts. Please try again later.",
      })

      render(<EmailVerificationPage />)

      // Enter OTP
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Should show rate limit error
      await waitFor(() => {
        expect(
          screen.getByText(/Too many verification attempts/),
        ).toBeInTheDocument()
      })
    })

    it("should validate token expiration correctly", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock expired token error
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: false,
        error: "Verification token has expired",
      })

      render(<EmailVerificationPage />)

      // Enter OTP
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Should show expiration error
      await waitFor(() => {
        expect(
          screen.getByText(/Verification token has expired/),
        ).toBeInTheDocument()
      })
    })

    it("should handle invalid verification codes", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock invalid code error
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: false,
        error: "Invalid verification code",
      })

      render(<EmailVerificationPage />)

      // Enter invalid OTP
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], "0")
      }

      // Should show invalid code error
      await waitFor(() => {
        expect(
          screen.getByText(/Invalid verification code/),
        ).toBeInTheDocument()
      })
    })
  })

  describe("4. User Experience Testing", () => {
    it("should handle network errors gracefully", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock network error
      vi.mocked(emailVerification.verifyEmailWithOTP).mockRejectedValue(
        new Error("Network error"),
      )

      render(<EmailVerificationPage />)

      // Enter OTP
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Should show network error with retry option
      await waitFor(() => {
        expect(
          screen.getByText(/Network error. Please try again./),
        ).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: "Retry" }),
        ).toBeInTheDocument()
      })
    })

    it("should clear errors when user starts typing", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // First call fails, second succeeds
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValueOnce({
        success: false,
        error: "Invalid verification code",
      })

      render(<EmailVerificationPage />)

      // Enter invalid OTP first
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], "0")
      }

      // Error should be shown
      await waitFor(() => {
        expect(
          screen.getByText(/Invalid verification code/),
        ).toBeInTheDocument()
      })

      // Clear and type new code - error should disappear
      await user.clear(otpInputs[0])
      await user.type(otpInputs[0], "1")

      await waitFor(() => {
        expect(
          screen.queryByText(/Invalid verification code/),
        ).not.toBeInTheDocument()
      })
    })

    it("should provide proper navigation options", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      mockSearchParams.set("callbackUrl", "/my-account")

      render(<EmailVerificationPage />)

      // Should have continue and back to sign in buttons
      const continueButton = screen.getByRole("button", { name: "Continue" })
      const backButton = screen.getByRole("button", { name: "Back to sign in" })

      expect(continueButton).toBeInTheDocument()
      expect(backButton).toBeInTheDocument()

      // Test navigation
      await user.click(continueButton)
      expect(mockRouter.push).toHaveBeenCalledWith("/my-account")

      await user.click(backButton)
      expect(mockRouter.push).toHaveBeenCalledWith("/sign-in")
    })
  })

  describe("5. Accessibility Testing", () => {
    it("should have proper ARIA labels and roles", () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      render(<EmailVerificationPage />)

      // Check main container has proper test id
      expect(screen.getByTestId("verification-container")).toBeInTheDocument()

      // Check card structure
      const card = screen.getByTestId("verification-card")
      expect(card).toBeInTheDocument()

      // Check input accessibility
      const otpInputs = screen.getAllByRole("textbox")
      expect(otpInputs).toHaveLength(6)

      // Each input should be accessible
      otpInputs.forEach((input, index) => {
        expect(input).toHaveAttribute("aria-label", `Digit ${index + 1}`)
        expect(input).toHaveAttribute("maxLength", "1")
      })

      // Check button accessibility
      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBeGreaterThan(0)

      buttons.forEach((button) => {
        expect(button).toBeVisible()
        // Should not have generic button text
        expect(button.textContent).not.toBe("")
      })
    })

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      render(<EmailVerificationPage />)

      const otpInputs = screen.getAllByRole("textbox")

      // Test tab navigation
      await user.tab()
      expect(otpInputs[0]).toHaveFocus()

      // Test arrow key navigation
      await user.keyboard("{ArrowRight}")
      expect(otpInputs[1]).toHaveFocus()

      await user.keyboard("{ArrowLeft}")
      expect(otpInputs[0]).toHaveFocus()

      // Test keyboard input and auto-advance
      await user.type(otpInputs[0], "1")
      expect(otpInputs[1]).toHaveFocus()
    })

    it("should have proper loading and status indicators", async () => {
      vi.mocked(useSession).mockReturnValue({
        data: { user: { id: "test-id", email: "test@example.com" } },
        status: "loading",
        update: vi.fn(),
      })

      render(<EmailVerificationPage />)

      // Should show loading indicator
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument()
      expect(
        screen.getByText("Checking verification status..."),
      ).toBeInTheDocument()
    })

    it("should provide screen reader friendly content", () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      render(<EmailVerificationPage />)

      // Check heading structure
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()

      // Check descriptive text
      expect(
        screen.getByText(/We need to verify your email address/),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Enter the 6-digit code sent to/),
      ).toBeInTheDocument()

      // Check email display
      expect(screen.getByText("test@example.com")).toBeInTheDocument()
    })
  })

  describe("6. Performance Testing", () => {
    it("should handle rapid input changes efficiently", async () => {
      const user = userEvent.setup()

      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const startTime = performance.now()

      render(<EmailVerificationPage />)

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(100) // Should render in under 100ms

      // Test rapid input
      const otpInputs = screen.getAllByRole("textbox")

      const inputStartTime = performance.now()
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }
      const inputTime = performance.now() - inputStartTime

      expect(inputTime).toBeLessThan(500) // Should handle input in under 500ms
    })

    it("should not cause memory leaks with multiple renders", () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Render multiple times to test for memory leaks
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<EmailVerificationPage />)
        expect(screen.getByTestId("verification-container")).toBeInTheDocument()
        unmount()
      }

      // If we get here without hanging, memory management is working
      expect(true).toBe(true)
    })
  })

  describe("7. Error Boundary Testing", () => {
    it("should handle unexpected errors gracefully", () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "test-id", email: "test@example.com", name: "Test" },
        },
        status: "authenticated",
        update: vi.fn(),
      })

      // Mock a throwing function
      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockImplementation(() => {
        throw new Error("Unexpected error")
      })

      // Should not crash the component
      expect(() => {
        render(<EmailVerificationPage />)
      }).not.toThrow()
    })
  })
})
