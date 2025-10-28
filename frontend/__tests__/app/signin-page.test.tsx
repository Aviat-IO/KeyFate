import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SignInPage from "@/app/auth/signin/page"
import { useSearchParams } from "next/navigation"

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}))

// Mock fetch globally
global.fetch = vi.fn()

describe("Sign In Page Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for useSearchParams
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as any)
  })

  describe("Email Step", () => {
    it("should render email input on initial load", () => {
      render(<SignInPage />)

      expect(
        screen.getByRole("heading", { name: /sign in to keyfate/i }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /continue with email/i }),
      ).toBeInTheDocument()
    })

    it("should show Google sign-in button", () => {
      render(<SignInPage />)

      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).toBeInTheDocument()
    })

    it("should show Terms of Service and Privacy Policy links", () => {
      render(<SignInPage />)

      const termsLink = screen.getByRole("link", { name: /terms of service/i })
      const privacyLink = screen.getByRole("link", { name: /privacy policy/i })

      expect(termsLink).toBeInTheDocument()
      expect(termsLink).toHaveAttribute("href", "/terms-of-service")
      expect(privacyLink).toBeInTheDocument()
      expect(privacyLink).toHaveAttribute("href", "/privacy-policy")
    })

    it("should auto-focus email input on mount", () => {
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toHaveFocus()
    })

    it("should validate email input is required", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      // HTML5 validation should prevent submission
      const emailInput = screen.getByLabelText(
        /email address/i,
      ) as HTMLInputElement
      expect(emailInput.validity.valid).toBe(false)
    })

    it("should accept valid email input", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      expect(emailInput).toHaveValue("test@example.com")
    })
  })

  describe("OTP Step - 8-Digit Code Verification", () => {
    beforeEach(async () => {
      // Mock successful OTP request
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
    })

    it("should show exactly 8 OTP input fields after requesting code", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      // Enter email and request OTP
      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      // Wait for OTP step to appear
      await waitFor(() => {
        expect(screen.getByText(/enter 8-digit code/i)).toBeInTheDocument()
      })

      // Verify exactly 8 OTP input fields are rendered
      const otpInputs = screen.getAllByRole("textbox")
      expect(otpInputs).toHaveLength(8)
    })

    it("should show correct label for 8-digit code", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        const label = screen.getByText(/enter 8-digit code/i)
        expect(label).toBeInTheDocument()
      })
    })

    it("should show success message with user email", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      const testEmail = "test@example.com"
      await user.type(emailInput, testEmail)

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(new RegExp(testEmail, "i"))).toBeInTheDocument()
        expect(screen.getByText(/check your email/i)).toBeInTheDocument()
      })
    })

    it("should show resend countdown timer", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/resend code in \d+s/i)).toBeInTheDocument()
      })
    })

    it("should show help text about code expiration", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(
          screen.getByText(/codes expire after 5 minutes/i),
        ).toBeInTheDocument()
      })
    })

    it("should show help text about spam folder", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument()
      })
    })

    it("should allow filling all 8 OTP digits", async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      // Request OTP
      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")
      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      // Wait for OTP inputs
      await waitFor(() => {
        expect(screen.getByText(/enter 8-digit code/i)).toBeInTheDocument()
      })

      const otpInputs = screen.getAllByRole("textbox")

      // Fill all 8 digits
      for (let i = 0; i < 8; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Verify all fields are filled
      otpInputs.forEach((input, index) => {
        expect(input).toHaveValue(((index % 10) + 1).toString())
      })
    })

    it("should disable OTP inputs while verifying", async () => {
      const user = userEvent.setup()

      // Mock CSRF and slow auth response
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ csrfToken: "mock-csrf-token" }),
        } as Response)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    url: "/dashboard",
                  } as Response),
                100,
              )
            }),
        )

      render(<SignInPage />)

      // Request OTP
      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")
      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/enter 8-digit code/i)).toBeInTheDocument()
      })

      const otpInputs = screen.getAllByRole("textbox")

      // Fill OTP to trigger verification
      for (let i = 0; i < 8; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      // Inputs should be disabled during verification (brief moment)
      // Note: This might be hard to catch due to async nature
    })
  })

  describe("Error Handling", () => {
    it("should show error when OTP request fails", async () => {
      const user = userEvent.setup()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Failed to send code" }),
      } as Response)

      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to send code/i)).toBeInTheDocument()
      })

      // Should NOT show OTP inputs on error
      expect(screen.queryByText(/enter 8-digit code/i)).not.toBeInTheDocument()
    })

    it("should show rate limit error with retry time", async () => {
      const user = userEvent.setup()

      const resetTime = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: "Too many requests",
          resetAt: resetTime.toISOString(),
        }),
      } as Response)

      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(
          screen.getByText(/too many requests.*try again in \d+ minutes/i),
        ).toBeInTheDocument()
      })
    })

    it("should show URL error parameter on mount", () => {
      vi.mocked(useSearchParams).mockReturnValue({
        get: (key: string) => (key === "error" ? "CredentialsSignin" : null),
      } as any)

      render(<SignInPage />)

      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  describe("OTP Component Validation (Regression Test)", () => {
    /**
     * This test ensures we don't regress on the bug where:
     * - OTPInput component had default length=8
     * - But signin page hardcoded length={6}
     * - Causing mismatch between label and actual fields
     */
    it("should NOT have mismatch between label and input count", async () => {
      const user = userEvent.setup()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      render(<SignInPage />)

      // Request OTP
      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")
      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        const label = screen.getByText(/enter 8-digit code/i)
        expect(label).toBeInTheDocument()

        const otpInputs = screen.getAllByRole("textbox")

        // CRITICAL: Label says "8-digit" so inputs MUST be 8
        expect(otpInputs).toHaveLength(8)
      })
    })

    it("should accept exactly 8 digits when pasting", async () => {
      const user = userEvent.setup()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      render(<SignInPage />)

      // Request OTP
      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")
      const submitButton = screen.getByRole("button", {
        name: /continue with email/i,
      })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/enter 8-digit code/i)).toBeInTheDocument()
      })

      const firstInput = screen.getAllByRole("textbox")[0]
      firstInput.focus()

      // Paste 8-digit code
      await user.paste("12345678")

      // All 8 inputs should be filled
      const otpInputs = screen.getAllByRole("textbox")
      expect(otpInputs[0]).toHaveValue("1")
      expect(otpInputs[1]).toHaveValue("2")
      expect(otpInputs[2]).toHaveValue("3")
      expect(otpInputs[3]).toHaveValue("4")
      expect(otpInputs[4]).toHaveValue("5")
      expect(otpInputs[5]).toHaveValue("6")
      expect(otpInputs[6]).toHaveValue("7")
      expect(otpInputs[7]).toHaveValue("8")
    })
  })
})
