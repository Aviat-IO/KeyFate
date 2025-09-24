import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { signIn } from "next-auth/react"

// Mock NextAuth with specific focus on redirect behavior
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

// Mock Next.js navigation
const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
}))

// Mock fetch for providers check
global.fetch = vi.fn()

// Import the component after mocking
import SignInPage from "@/app/sign-in/page"

describe("Sign-In No Redirect Integration Tests", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear all search params manually
    Array.from(mockSearchParams.keys()).forEach(key => {
      mockSearchParams.delete(key)
    })

    // Mock successful providers check
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ google: true }),
    })

    // Mock window.location to track any redirect attempts
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in",
        pathname: "/sign-in",
        search: "",
        toString: () => "http://localhost:3000/sign-in",
      },
      writable: true,
    })

    // Mock window.history for URL manipulation
    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    })
  })

  describe("NextAuth Redirect Prevention", () => {
    it("should NOT redirect when signIn returns CredentialsSignin error", async () => {
      // This test replicates the exact problem described by the user
      // signIn with redirect: false should prevent redirects but may still cause them
      const originalLocation = window.location.href

      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false,
        status: 401,
        url: null
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

      // Wait for any potential async operations
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      }, { timeout: 3000 })

      // Verify that signIn was called with redirect: false
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "wrongpassword",
        redirect: false,
        callbackUrl: "/",
      })

      // Most importantly: verify NO redirect occurred
      expect(window.location.href).toBe(originalLocation)
      expect(window.location.pathname).toBe("/sign-in")
      expect(window.location.search).toBe("")

      // Error should be visible without any redirects
      expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
    })

    it("should handle the specific redirect URL pattern from user's issue", async () => {
      // User reported seeing: /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F
      // This should NOT happen with redirect: false
      const mockLocationWithCallback = {
        href: "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
        pathname: "/sign-in",
        search: "?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
        toString: () => "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
      }

      // Simulate the problematic scenario
      mockSearchParams.set("callbackUrl", "http://localhost:3000/")

      Object.defineProperty(window, "location", {
        value: mockLocationWithCallback,
        writable: true,
      })

      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false,
        status: 401,
        url: null
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

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // Verify signIn was called with proper redirect: false
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "wrongpassword",
        redirect: false,
        callbackUrl: "http://localhost:3000/",
      })

      // The key test: location should NOT change
      // Even if we started with a callback URL, we should stay on the sign-in page
      expect(window.location.pathname).toBe("/sign-in")

      // Error should be persistent and visible
      expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
    })

    it("should prevent any automatic redirects even if NextAuth tries to redirect", async () => {
      // Test edge case where NextAuth might ignore redirect: false
      vi.mocked(signIn).mockImplementation(async (provider, options) => {
        // Simulate NextAuth trying to redirect despite redirect: false
        // This should be prevented by our component logic
        return {
          error: "CredentialsSignin",
          ok: false,
          status: 401,
          url: "http://localhost:3000/sign-in?error=CredentialsSignin&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F"
        }
      })

      const originalHref = window.location.href
      const locationSetter = vi.fn()

      Object.defineProperty(window.location, "href", {
        set: locationSetter,
        get: () => originalHref
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
      })

      // Verify NO attempts were made to change window.location.href
      expect(locationSetter).not.toHaveBeenCalled()

      // Error should be visible
      expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
    })
  })

  describe("Error Persistence Without Redirects", () => {
    it("should keep error visible until user submits new credentials", async () => {
      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      // First failed attempt
      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // Error should persist while user types
      await user.clear(passwordInput)
      await user.type(passwordInput, "newpassword")

      expect(screen.getByRole("alert")).toBeInTheDocument()

      // Error should clear only on new submission
      vi.mocked(signIn).mockResolvedValue({ ok: true })

      await act(async () => {
        await user.click(submitButton)
      })

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      })
    })

    it("should handle multiple consecutive errors without any redirects", async () => {
      const originalLocation = window.location.href

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      // Multiple failed attempts
      const attempts = [
        { error: "CredentialsSignin", message: "Invalid email or password. Please check your credentials and try again." },
        { error: "Configuration", message: "There is a problem with the authentication configuration. Please try again later." },
        { error: "AccessDenied", message: "Access denied. You do not have permission to sign in." }
      ]

      for (const attempt of attempts) {
        vi.mocked(signIn).mockResolvedValue({
          error: attempt.error,
          ok: false
        })

        await user.clear(emailInput)
        await user.clear(passwordInput)
        await user.type(emailInput, "test@example.com")
        await user.type(passwordInput, "password123")

        await act(async () => {
          await user.click(submitButton)
        })

        await waitFor(() => {
          expect(screen.getByRole("alert")).toBeInTheDocument()
          expect(screen.getByText(attempt.message)).toBeInTheDocument()
        })

        // Verify no redirect occurred between attempts
        expect(window.location.href).toBe(originalLocation)
      }
    })
  })
})