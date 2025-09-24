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
const mockReplace = vi.fn()
const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
  })),
}))

// Mock fetch for providers check
global.fetch = vi.fn()

// Import the component after mocking
import SignInPage from "@/app/sign-in/page"

describe("Sign-In Redirect Prevention", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete("error")
    mockSearchParams.delete("callbackUrl")
    mockReplace.mockClear()
    mockPush.mockClear()

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

  describe("TDD: Prevent redirects on authentication failure", () => {
    it("should not redirect when credentials signin fails", async () => {
      // RED PHASE: This test should fail initially
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

      // CRITICAL: Should NOT trigger any redirects
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()

      // Should remain on sign-in page
      expect(window.location.href).toBe("http://localhost:3000/sign-in")

      // Should display error message persistently
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
      })
    })

    it("should not redirect even if NextAuth callback URL contains redirect", async () => {
      // RED PHASE: Simulate NextAuth trying to redirect after failed auth
      mockSearchParams.set("callbackUrl", "http://localhost:3000/")

      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false,
        status: 401,
        url: "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F&error=CredentialsSignin"
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

      // CRITICAL: Should NOT redirect despite callback URL
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(window.location.href).toBe("http://localhost:3000/sign-in")

      // Error should persist without redirect
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      }, { timeout: 3000 }) // Give more time to ensure no redirect happens
    })

    it("should keep user on page with error visible for minimum duration", async () => {
      // RED PHASE: Ensure error doesn't flash briefly before redirect
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

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Error should be visible immediately
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // Wait a bit to ensure no redirect happens
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Error should still be visible after waiting
      expect(screen.getByRole("alert")).toBeInTheDocument()
      expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()

      // Should still be on sign-in page
      expect(window.location.href).toBe("http://localhost:3000/sign-in")
    })

    it("should allow successful authentication to redirect normally", async () => {
      // GREEN PHASE: Ensure successful auth still works
      mockSearchParams.set("callbackUrl", "/dashboard")

      vi.mocked(signIn).mockResolvedValue({
        ok: true,
        error: null,
        status: 200,
        url: "/dashboard"
      })

      // Mock window location setter for successful redirect
      const mockLocation = { href: "http://localhost:3000/sign-in?callbackUrl=%2Fdashboard" }
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
      await user.type(passwordInput, "validpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Successful auth should redirect
      await waitFor(() => {
        expect(mockLocation.href).toBe("/dashboard")
      })
    })

    it("should handle error state persistence across form interactions", async () => {
      // RED PHASE: Error should persist until new form submission
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

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // User modifies input - error should persist
      await user.clear(passwordInput)
      await user.type(passwordInput, "newpassword")

      // Error should still be visible
      expect(screen.getByRole("alert")).toBeInTheDocument()

      // No redirects should have occurred
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })
})