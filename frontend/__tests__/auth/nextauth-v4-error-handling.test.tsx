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

describe("NextAuth v4 Error Handling", () => {
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

  describe("NextAuth v4 Redirect Prevention", () => {
    it("should prevent NextAuth v4 server-side redirects on credentials failure", async () => {
      // Simulate NextAuth v4 behavior where signIn might resolve successfully
      // but indicate failure through result properties
      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false,
        status: 401,
        url: null,
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

      // Should display error without redirect
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
      })

      // Should remain on sign-in page
      expect(window.location.href).toBe("http://localhost:3000/sign-in")
    })

    it("should handle NextAuth v4 error parameter from URL gracefully", async () => {
      // Simulate URL error parameter (from potential NextAuth redirect)
      mockSearchParams.set("error", "CredentialsSignin")
      mockSearchParams.set("callbackUrl", "http://localhost:3000/")

      await act(async () => {
        render(<SignInPage />)
      })

      // Should show error from URL parameter
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
      })

      // When user attempts sign-in again, should clear URL error and try again
      vi.mocked(signIn).mockResolvedValue({
        error: "CredentialsSignin",
        ok: false
      })

      const emailInput = screen.getByLabelText("Email")
      const passwordInput = screen.getByLabelText("Password")
      const submitButton = screen.getByRole("button", { name: /sign in/i })

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should still show error and remain on page
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      expect(window.location.href).toBe("http://localhost:3000/sign-in")
    })

    it("should handle successful authentication after failed attempts", async () => {
      // First, failed attempt
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

      await user.type(emailInput, "test@example.com")
      await user.type(passwordInput, "wrongpassword")

      await act(async () => {
        await user.click(submitButton)
      })

      // Should show error
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      // Then, successful attempt
      vi.mocked(signIn).mockResolvedValueOnce({
        ok: true,
        error: null
      })

      // Mock successful redirect
      const mockLocation = { href: "http://localhost:3000/sign-in" }
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

    it("should handle network errors without redirect", async () => {
      // Simulate network failure
      vi.mocked(signIn).mockRejectedValue(new TypeError("Failed to fetch"))

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

      // Should show network error and remain on page
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument()
      })

      expect(window.location.href).toBe("http://localhost:3000/sign-in")
    })
  })
})