/**
 * End-to-End Email Verification Flow Testing
 * Task 1.6: Complete user journey integration testing
 *
 * Test Coverage:
 * - Complete signup to verification flow
 * - Google OAuth with email verification
 * - Email link verification flow
 * - OTP verification flow
 * - Error recovery scenarios
 * - Performance benchmarks
 * - Real-world user scenarios
 */

import { EmailVerificationPage } from "@/components/auth/email-verification-page"
import { useToast } from "@/hooks/use-toast"
import * as emailVerification from "@/lib/email-verification"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock all external dependencies
vi.mock("next-auth/react")
vi.mock("next/navigation")
vi.mock("@/lib/email-verification")
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}))

const mockSignIn = vi.mocked(signIn)
const mockUseSession = vi.mocked(useSession)
const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

const mockToast = vi.fn()

// Helper to simulate different user states
const createMockSession = (verified = false, email = "test@example.com") => ({
  data: {
    user: {
      id: "test-user-id",
      email,
      name: "Test User",
      image: verified ? "https://example.com/avatar.jpg" : null,
    },
  },
  status: "authenticated" as const,
  update: vi.fn(),
})

describe.skip("Email Verification E2E (disabled during NextAuth migration)", () => {
  it("placeholder", () => expect(true).toBe(true))
})

describe("End-to-End Email Verification Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseRouter.mockReturnValue(mockRouter)
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
    })

    // Performance timing mock
    Object.defineProperty(window, "performance", {
      value: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn(),
      },
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("Complete Signup → Verification Flow", () => {
    it("should handle complete user journey from signup to verification", async () => {
      const user = userEvent.setup()

      // Step 1: User signs up with Google OAuth
      mockSignIn.mockResolvedValue({
        ok: true,
        status: 200,
        error: undefined,
        url: "http://localhost:3000/auth/verify-email?email=newuser@example.com",
      })

      // Step 2: OAuth creates unverified user session
      mockUseSession.mockReturnValue(
        createMockSession(false, "newuser@example.com"),
      )

      // Step 3: Email verification status check
      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Step 4: Simulate verification email in background
      vi.mocked(emailVerification.resendVerificationEmail).mockResolvedValue({
        success: true,
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "newuser@example.com")
      searchParams.set("callbackUrl", "/dashboard")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Verify initial state
      expect(screen.getByText("Verify your email address")).toBeInTheDocument()
      expect(
        screen.getByText(/Enter the 6-digit code sent to/),
      ).toBeInTheDocument()
      expect(screen.getByText("newuser@example.com")).toBeInTheDocument()

      // Step 5: User enters verification code
      const otpInputs = screen.getAllByRole("textbox")
      const verificationCode = "123456"

      for (let i = 0; i < verificationCode.length; i++) {
        await user.type(otpInputs[i], verificationCode[i])
      }

      // Step 6: Mock successful verification
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: true,
        user: {
          id: "test-user-id",
          email: "newuser@example.com",
          name: "Test User",
          email_verified: true,
        },
      })

      // Step 7: Verify completion flow
      await waitFor(() => {
        expect(emailVerification.verifyEmailWithOTP).toHaveBeenCalledWith(
          "newuser@example.com",
          verificationCode,
        )
      })

      // Step 8: Final success state visible first
      await waitFor(
        () => {
          expect(screen.getByText("Email Verified!")).toBeInTheDocument()
        },
        { timeout: 2000 },
      )

      // Step 9: Then router navigation happens with timeout
      await waitFor(
        () => {
          expect(mockRouter.push).toHaveBeenCalledWith("/dashboard")
        },
        { timeout: 2000 }, // Need longer timeout for the 1500ms setTimeout in component
      )
    })

    it("should handle email verification link flow", async () => {
      const user = userEvent.setup()

      // Simulate user clicking email verification link
      const searchParams = new URLSearchParams()
      searchParams.set("token", "email-verification-token-123")
      searchParams.set("email", "linkuser@example.com")
      searchParams.set("callbackUrl", "/dashboard")
      mockUseSearchParams.mockReturnValue(searchParams)

      mockUseSession.mockReturnValue(
        createMockSession(false, "linkuser@example.com"),
      )

      // Mock link verification
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: true,
        user: {
          id: "test-user-id",
          email: "linkuser@example.com",
          email_verified: true,
        },
      })

      render(<EmailVerificationPage />)

      // Should automatically attempt verification with token
      await waitFor(() => {
        expect(emailVerification.verifyEmailWithOTP).toHaveBeenCalledWith(
          "linkuser@example.com",
          "email-verification-token-123",
        )
      })

      // Should show success and redirect
      await waitFor(
        () => {
          expect(screen.getByText("Email Verified!")).toBeInTheDocument()
        },
        { timeout: 2000 },
      )

      await waitFor(
        () => {
          expect(mockRouter.push).toHaveBeenCalledWith("/dashboard")
        },
        { timeout: 2000 },
      )
    })

    it("should handle user switching between verification methods", async () => {
      const user = userEvent.setup()

      mockUseSession.mockReturnValue(
        createMockSession(false, "switchuser@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "switchuser@example.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // User tries invalid OTP first
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValueOnce({
        success: false,
        error: "Invalid verification code",
      })

      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], "0")
      }

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid verification code/),
        ).toBeInTheDocument()
      })

      // User clicks resend button
      vi.mocked(emailVerification.resendVerificationEmail).mockResolvedValue({
        success: true,
      })

      const resendButton = screen.getByRole("button", { name: /resend/i })
      await user.click(resendButton)

      await waitFor(() => {
        expect(emailVerification.resendVerificationEmail).toHaveBeenCalledWith(
          "switchuser@example.com",
        )
      })

      // User tries valid OTP
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValueOnce({
        success: true,
        user: {
          id: "test-user-id",
          email: "switchuser@example.com",
          email_verified: true,
        },
      })

      // Clear inputs first, then enter new code
      for (let i = 0; i < 6; i++) {
        await user.clear(otpInputs[i])
      }

      // Enter new valid code
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Wait for verification call to complete first
      await waitFor(() => {
        expect(emailVerification.verifyEmailWithOTP).toHaveBeenCalledWith(
          "switchuser@example.com",
          "123456",
        )
      })

      // Then wait for success state to show
      await waitFor(
        () => {
          expect(screen.getByText("Email Verified!")).toBeInTheDocument()
        },
        { timeout: 2000 },
      )
    })
  })

  describe("Google OAuth Integration Scenarios", () => {
    it("should handle Google OAuth with immediate verification", async () => {
      // User with Google OAuth that has verified email domain
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "google-user-id",
            email: "verified@gmail.com",
            name: "Google User",
            image: "https://lh3.googleusercontent.com/avatar",
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
          id: "google-user-id",
          email: "verified@gmail.com",
          email_verified: true,
        },
      })

      const searchParams = new URLSearchParams()
      searchParams.set("callbackUrl", "/dashboard")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Should show already verified state
      await waitFor(() => {
        expect(screen.getByText("Email Already Verified")).toBeInTheDocument()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: "Already verified",
        description: "Your email is already verified. Redirecting...",
      })

      await waitFor(
        () => {
          expect(mockRouter.push).toHaveBeenCalledWith("/dashboard")
        },
        { timeout: 2500 },
      )
    })

    it("should handle Google OAuth with required verification", async () => {
      const user = userEvent.setup()

      // Google OAuth user with unverified email
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "google-unverified-id",
            email: "unverified@custom-domain.com",
            name: "Custom Domain User",
            image: "https://lh3.googleusercontent.com/avatar",
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

      const searchParams = new URLSearchParams()
      searchParams.set("email", "unverified@custom-domain.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Should show verification form
      expect(screen.getByText("Verify your email address")).toBeInTheDocument()
      expect(
        screen.getByText("unverified@custom-domain.com"),
      ).toBeInTheDocument()

      // Resend should work for OAuth users
      vi.mocked(emailVerification.resendVerificationEmail).mockResolvedValue({
        success: true,
      })

      const resendButton = screen.getByRole("button", { name: /resend/i })
      await user.click(resendButton)

      expect(emailVerification.resendVerificationEmail).toHaveBeenCalledWith(
        "unverified@custom-domain.com",
      )
    })
  })

  describe("Error Recovery Scenarios", () => {
    it("should handle network failures gracefully", async () => {
      const user = userEvent.setup()

      mockUseSession.mockReturnValue(
        createMockSession(false, "network@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock network failure followed by success
      vi.mocked(emailVerification.verifyEmailWithOTP)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          success: true,
          user: {
            id: "test-user-id",
            email: "network@example.com",
            email_verified: true,
          },
        })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "network@example.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Enter OTP - will fail with network error
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], "1")
      }

      await waitFor(() => {
        expect(
          screen.getByText(/Network error. Please try again./),
        ).toBeInTheDocument()
      })

      // Retry might not be needed if the form resets automatically; continue
      const maybeRetry = screen.queryByRole("button", { name: "Retry" })
      if (maybeRetry) {
        await user.click(maybeRetry)
      }

      // Try again - should succeed (overwrite instead of clear)
      for (let i = 0; i < 6; i++) {
        await user.click(otpInputs[i])
        await user.type(otpInputs[i], (i + 1).toString())
      }

      await waitFor(() => {
        expect(screen.getByText("Email Verified!")).toBeInTheDocument()
      })
    })

    it("should handle session expiration during verification", async () => {
      const user = userEvent.setup()

      // Start with authenticated session
      mockUseSession.mockReturnValue(
        createMockSession(false, "session@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "session@example.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Simulate session expiration
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      })

      // Try to verify - should redirect to sign-in
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Component should detect session change and redirect
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/sign-in")
      })
    })

    it("should handle rate limiting gracefully", async () => {
      const user = userEvent.setup()

      mockUseSession.mockReturnValue(
        createMockSession(false, "ratelimit@example.com"),
      )

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

      vi.mocked(emailVerification.resendVerificationEmail).mockResolvedValue({
        success: false,
        error: "Rate limit exceeded. Please wait 60 seconds.",
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "ratelimit@example.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Try verification - should hit rate limit
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], "9")
      }

      await waitFor(() => {
        expect(
          screen.getByText(/Too many verification attempts/),
        ).toBeInTheDocument()
      })

      // Try resend - should also hit rate limit
      const resendButton = screen.getByRole("button", { name: /resend/i })
      await user.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument()
      })

      // Should show appropriate retry guidance
      expect(screen.getByText(/Please wait/)).toBeInTheDocument()
    })
  })

  describe("Performance Benchmarks", () => {
    it("should load verification page within performance budget", async () => {
      mockUseSession.mockReturnValue(
        createMockSession(false, "perf@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const startTime = performance.now()

      render(<EmailVerificationPage />)

      // Page should render quickly
      expect(screen.getByTestId("verification-container")).toBeInTheDocument()

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(100) // Should render in under 100ms
    })

    it("should handle rapid user input efficiently", async () => {
      const user = userEvent.setup()

      mockUseSession.mockReturnValue(
        createMockSession(false, "rapid@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      render(<EmailVerificationPage />)

      const otpInputs = screen.getAllByRole("textbox")

      const inputStartTime = performance.now()

      // Rapid input simulation
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      const inputTime = performance.now() - inputStartTime
      expect(inputTime).toBeLessThan(200) // Should handle input in under 200ms
    })

    it("should complete verification flow within time budget", async () => {
      const user = userEvent.setup()

      mockUseSession.mockReturnValue(
        createMockSession(false, "fast@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      // Mock fast verification
      vi.mocked(emailVerification.verifyEmailWithOTP).mockResolvedValue({
        success: true,
        user: {
          id: "test-user-id",
          email: "fast@example.com",
          email_verified: true,
        },
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "fast@example.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      const verificationStartTime = performance.now()

      // Complete verification flow
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      await waitFor(() => {
        expect(emailVerification.verifyEmailWithOTP).toHaveBeenCalled()
      })

      const verificationTime = performance.now() - verificationStartTime
      expect(verificationTime).toBeLessThan(1000) // Should complete in under 1 second
    })
  })

  describe("Real-World User Scenarios", () => {
    it("should handle user leaving and returning to verification page", async () => {
      // User starts verification
      mockUseSession.mockReturnValue(
        createMockSession(false, "returner@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "returner@example.com")
      searchParams.set("callbackUrl", "/dashboard")
      mockUseSearchParams.mockReturnValue(searchParams)

      const { unmount } = render(<EmailVerificationPage />)

      expect(screen.getByText("Verify your email address")).toBeInTheDocument()

      // User leaves page (navigates away)
      unmount()

      // User returns - should maintain state
      render(<EmailVerificationPage />)

      // Should check verification status again
      await waitFor(() => {
        expect(
          emailVerification.checkEmailVerificationStatus,
        ).toHaveBeenCalledTimes(2)
      })

      expect(screen.getByText("Verify your email address")).toBeInTheDocument()
      expect(screen.getByText("returner@example.com")).toBeInTheDocument()
    })

    it("should handle mobile device scenarios", async () => {
      const user = userEvent.setup()

      // Simulate mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      })

      mockUseSession.mockReturnValue(
        createMockSession(false, "mobile@example.com"),
      )

      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockResolvedValue({
        isVerified: false,
        user: null,
      })

      const searchParams = new URLSearchParams()
      searchParams.set("email", "mobile@example.com")
      mockUseSearchParams.mockReturnValue(searchParams)

      render(<EmailVerificationPage />)

      // Should be responsive
      const container = screen.getByTestId("verification-container")
      expect(container).toHaveClass(/px-4/) // Mobile padding

      // Touch interactions should work
      const otpInputs = screen.getAllByRole("textbox")
      for (let i = 0; i < 6; i++) {
        await user.click(otpInputs[i])
        await user.type(otpInputs[i], (i + 1).toString())
      }

      expect(otpInputs[5]).toHaveValue("6")
    })

    it("should handle slow network conditions", async () => {
      const user = userEvent.setup()

      mockUseSession.mockReturnValue(
        createMockSession(false, "slow@example.com"),
      )

      // Mock slow verification status check
      vi.mocked(
        emailVerification.checkEmailVerificationStatus,
      ).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ isVerified: false, user: null }), 1000),
          ),
      )

      render(<EmailVerificationPage />)

      // Should show loading state
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument()
      expect(
        screen.getByText("Checking verification status..."),
      ).toBeInTheDocument()

      // After slow load, should show verification form
      await waitFor(
        () => {
          expect(
            screen.getByText("Verify your email address"),
          ).toBeInTheDocument()
        },
        { timeout: 1500 },
      )

      expect(screen.getByText("slow@example.com")).toBeInTheDocument()
    })
  })
})
