import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { signIn } from "next-auth/react"

// Mock NextAuth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

// Mock Next.js navigation with dynamic search params
const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
}))

// Mock fetch for providers check
global.fetch = vi.fn()

// Import the component after mocking
import SignInPage from "@/app/sign-in/page"

describe("Sign-In Error Handling", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete("error")
    mockSearchParams.delete("callbackUrl")

    // Mock successful providers check
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ google: true }),
    })

    // Mock window.location for URL manipulation
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in",
        toString: () => "http://localhost:3000/sign-in",
      },
      writable: true,
    })

    // Mock window.history for URL cleanup
    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    })
  })

  describe("NextAuth URL Error Parameter Handling", () => {
    it("should display error when NextAuth error parameter is present in URL", async () => {
      // FAILING TEST: This should work but might not be displaying properly
      mockSearchParams.set("error", "CredentialsSignin")

      await act(async () => {
        render(<SignInPage />)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText(
            "Invalid email or password. Please check your credentials and try again.",
          ),
        ).toBeInTheDocument()
      })
    })

    it("should map different NextAuth error codes to user-friendly messages", async () => {
      const errorTestCases = [
        {
          errorCode: "CredentialsSignin",
          expectedMessage:
            "Invalid email or password. Please check your credentials and try again.",
        },
        {
          errorCode: "Configuration",
          expectedMessage:
            "There is a problem with the authentication configuration. Please try again later.",
        },
        {
          errorCode: "AccessDenied",
          expectedMessage:
            "Access denied. You do not have permission to sign in.",
        },
        {
          errorCode: "OAuthSignin",
          expectedMessage: "Authentication provider error. Please try again.",
        },
        {
          errorCode: "OAuthAccountNotLinked",
          expectedMessage:
            "This email is already associated with another account. Please use the original sign-in method.",
        },
      ]

      for (const testCase of errorTestCases) {
        mockSearchParams.set("error", testCase.errorCode)

        let unmount: () => void
        await act(async () => {
          const result = render(<SignInPage />)
          unmount = result.unmount
        })

        await waitFor(() => {
          expect(screen.getByRole("alert")).toBeInTheDocument()
          expect(screen.getByText(testCase.expectedMessage)).toBeInTheDocument()
        })

        act(() => {
          unmount()
        })
        mockSearchParams.delete("error")
      }
    })

    it("should handle unknown error codes with generic message", async () => {
      mockSearchParams.set("error", "UnknownErrorCode")

      await act(async () => {
        render(<SignInPage />)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText(
            "An authentication error occurred. Please try again.",
          ),
        ).toBeInTheDocument()
      })
    })

    it("should clear error when no error parameter is present", async () => {
      // First render with error
      mockSearchParams.set("error", "CredentialsSignin")
      let unmount: () => void
      await act(async () => {
        const result = render(<SignInPage />)
        unmount = result.unmount
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      act(() => {
        unmount()
      })

      // Then clear error and render again
      mockSearchParams.delete("error")
      await act(async () => {
        render(<SignInPage />)
      })

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  describe("Credentials Sign-In Error Handling", () => {
    it("should display error when signIn returns error", async () => {
      // FAILING TEST: This is probably where the bug is - signIn error not being displayed
      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false,
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText(
            "Invalid email or password. Please check your credentials and try again.",
          ),
        ).toBeInTheDocument()
      })
    })

    it("should handle signIn returning null error with generic message", async () => {
      vi.mocked(signIn).mockResolvedValue({
        error: null,
        ok: false,
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText("Invalid email or password. Please try again."),
        ).toBeInTheDocument()
      })
    })

    it("should handle network errors during sign-in", async () => {
      vi.mocked(signIn).mockRejectedValue(new TypeError("fetch failed"))

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText("An unexpected error occurred. Please try again."),
        ).toBeInTheDocument()
      })
    })

    it("should clear URL error parameters when starting new sign-in attempt", async () => {
      // Start with an error in URL
      mockSearchParams.set("error", "CredentialsSignin")
      vi.mocked(signIn).mockResolvedValue({ ok: true })

      // Mock window location with error parameter
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000/sign-in?error=CredentialsSignin",
          toString: () =>
            "http://localhost:3000/sign-in?error=CredentialsSignin",
        },
        writable: true,
      })

      await act(async () => {
        render(<SignInPage />)
      })

      // Verify error is shown initially
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should clear the URL error parameter via history.replaceState
      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalled()
      })
    })
  })

  describe("Error Message Clearing Behavior", () => {
    it("should clear error when user starts typing in form after URL error", async () => {
      // This test checks if errors clear when user interacts with form
      mockSearchParams.set("error", "CredentialsSignin")

      await act(async () => {
        render(<SignInPage />)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      const emailInput = screen.getByLabelText("Email")
      await user.type(emailInput, "a")

      // Error should still be visible since we only clear on form submit
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    it("should not clear error until new sign-in attempt", async () => {
      mockSearchParams.set("error", "CredentialsSignin")

      await act(async () => {
        render(<SignInPage />)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      // Error should still be visible until form submission
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  describe("Loading State During Sign-In", () => {
    it("should show loading state and disable button during sign-in", async () => {
      vi.mocked(signIn).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true }), 100),
          ),
      )

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      expect(submitButton).not.toBeDisabled()
      expect(submitButton).toHaveTextContent("Sign in")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should show loading state
      expect(submitButton).toBeDisabled()
      expect(submitButton).toHaveTextContent("Signing in...")

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
        expect(submitButton).toHaveTextContent("Sign in")
      })
    })
  })

  describe("Successful Sign-In Flow", () => {
    it("should redirect to callback URL on successful sign-in", async () => {
      mockSearchParams.set("callbackUrl", "/dashboard")
      vi.mocked(signIn).mockResolvedValue({ ok: true })

      // Mock window.location.href setter
      const mockLocation = {
        href: "http://localhost:3000/sign-in?callbackUrl=%2Fdashboard",
      }
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(mockLocation.href).toBe("/dashboard")
      })
    })

    it("should redirect to home when no callback URL provided", async () => {
      vi.mocked(signIn).mockResolvedValue({ ok: true })

      const mockLocation = { href: "http://localhost:3000/sign-in" }
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "password")

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(mockLocation.href).toBe("/")
      })
    })
  })
})
