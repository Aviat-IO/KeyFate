import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { signIn } from "next-auth/react"

// Mock NextAuth
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

describe("Real-World Error Behavior", () => {
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
        pathname: "/sign-in",
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

  describe("Specific Redirect Prevention", () => {
    it("should NOT redirect to /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F on wrong password", async () => {
      // This test reproduces the exact issue described by the user
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

      await user.type(emailInput, "user@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Error should appear immediately
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
      }, { timeout: 1000 })

      // Should NOT redirect to the problematic URL
      expect(window.location.href).not.toContain("callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F")
      expect(window.location.href).toBe("http://localhost:3000/sign-in")
      expect(window.location.pathname).toBe("/sign-in")

      // Error should persist for at least 2 seconds (not just flash briefly)
      await new Promise(resolve => setTimeout(resolve, 2000))
      expect(screen.getByRole("alert")).toBeInTheDocument()

      // Should still be on the correct page
      expect(window.location.href).toBe("http://localhost:3000/sign-in")
      expect(window.location.pathname).toBe("/sign-in")
    })

    it("should handle the case where user arrives from a callback URL but authentication fails", async () => {
      // Set initial callback URL (simulating user coming from protected page)
      mockSearchParams.set("callbackUrl", "http://localhost:3000/")

      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false
      })

      // Mock initial URL with callback
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
          pathname: "/sign-in",
          toString: () => "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
        },
        writable: true,
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "user@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should show error and NOT redirect
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // URL should not change to add error parameter with redirect
      expect(window.location.href).not.toContain("error=CredentialsSignin")
      expect(window.location.pathname).toBe("/sign-in")

      // Error should persist
      await new Promise(resolve => setTimeout(resolve, 1000))
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    it("should correctly handle successful authentication after failed attempts", async () => {
      // Start with failed attempt
      vi.mocked(signIn).mockResolvedValueOnce({
        error: "CredentialsSignin",
        ok: false
      })

      await act(async () => {
        render(<SignInPage />)
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "user@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should show error
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // Clear password and try again with success
      vi.mocked(signIn).mockResolvedValueOnce({
        ok: true,
        error: null
      })

      const mockLocation = {
        href: "http://localhost:3000/sign-in",
        pathname: "/sign-in"
      }
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      })

      await user.clear(passwordInput)
      await user.type(passwordInput, "correctpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should redirect on success
      await waitFor(() => {
        expect(mockLocation.href).toBe("/")
      })
    })

    it("should ensure error message remains visible until user takes action", async () => {
      // Test that error doesn't disappear after a brief flash
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

      await user.type(emailInput, "user@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Error should be visible
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // Check at multiple time intervals that error persists
      const checkTimes = [500, 1000, 1500, 2000, 3000]

      for (const time of checkTimes) {
        await new Promise(resolve => setTimeout(resolve, time === 500 ? 500 : 500))
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
        expect(window.location.pathname).toBe("/sign-in")
      }
    })
  })
})