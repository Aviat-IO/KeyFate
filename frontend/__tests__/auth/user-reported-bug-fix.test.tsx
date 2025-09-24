import { render, screen, waitFor, act } from "@testing-library/react"
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

/**
 * USER REPORTED BUG FIX VERIFICATION
 *
 * Original issue:
 * - User enters incorrect password
 * - Error message flashes briefly
 * - Page redirects to /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F
 * - Error message disappears
 *
 * Fixed behavior:
 * - User enters incorrect password
 * - Error message appears and stays visible
 * - NO redirect occurs
 * - User can correct password and try again
 */
describe("USER REPORTED BUG FIX VERIFICATION", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Clear search params
    Array.from(mockSearchParams.keys()).forEach(key => {
      mockSearchParams.delete(key)
    })

    // Mock successful providers check
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ google: true }),
    })

    // Mock window location
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in",
        pathname: "/sign-in",
        search: "",
        toString: () => "http://localhost:3000/sign-in",
      },
      writable: true,
    })

    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
        pushState: vi.fn(),
      },
      writable: true,
    })
  })

  it("FIXED: Error persists without redirect when user enters wrong password", async () => {
    // This test reproduces the exact user scenario and verifies the fix

    // Mock the authentication failure that was causing the redirect
    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null
    })

    await act(async () => {
      render(<SignInPage />)
    })

    // User fills in the form
    const emailInput = screen.getByLabelText("Email")
    const passwordInput = screen.getByLabelText("Password")
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    await user.type(emailInput, "user@example.com")
    await user.type(passwordInput, "wrongpassword") // Incorrect password

    // Remember initial location
    const initialHref = window.location.href
    const initialPathname = window.location.pathname

    // Submit the form (this was causing redirect before fix)
    await act(async () => {
      await user.click(submitButton)
    })

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    }, { timeout: 5000 })

    // CRITICAL ASSERTIONS - The fix ensures these conditions:

    // 1. No redirect occurred
    expect(window.location.href).toBe(initialHref)
    expect(window.location.pathname).toBe(initialPathname)

    // 2. URL does not contain the problematic callback parameter pattern
    expect(window.location.href).not.toContain("callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F")

    // 3. Error message is displayed and persistent (not just a flash)
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()

    // 4. Error persists over time (simulate the "flash" issue)
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(window.location.href).toBe(initialHref) // Still no redirect

    // 5. User can correct the password and try again
    await user.clear(passwordInput)
    await user.type(passwordInput, "correctpassword")

    // Error should still be visible until new submission
    expect(screen.getByRole("alert")).toBeInTheDocument()

    // Mock successful login
    vi.mocked(signIn).mockResolvedValue({
      ok: true,
      error: null
    })

    // Track location change for successful redirect
    const mockLocationForSuccess = {
      href: "http://localhost:3000/sign-in"
    }
    Object.defineProperty(window, "location", {
      value: mockLocationForSuccess,
      writable: true,
    })

    await act(async () => {
      await user.click(submitButton)
    })

    // On success, should redirect to home page
    await waitFor(() => {
      expect(mockLocationForSuccess.href).toBe("/")
    })

    // Error should be cleared on successful login
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("FIXED: Handles multiple consecutive errors without redirects", async () => {
    // Test that multiple failed attempts don't cause redirects

    await act(async () => {
      render(<SignInPage />)
    })

    const emailInput = screen.getByLabelText("Email")
    const passwordInput = screen.getByLabelText("Password")
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    const initialLocation = window.location.href

    // Multiple failed attempts with different error types
    const errorScenarios = [
      { error: "CredentialsSignin", message: "Invalid email or password. Please check your credentials and try again." },
      { error: "Configuration", message: "There is a problem with the authentication configuration. Please try again later." },
      { error: "AccessDenied", message: "Access denied. You do not have permission to sign in." }
    ]

    for (let i = 0; i < errorScenarios.length; i++) {
      const scenario = errorScenarios[i]

      vi.mocked(signIn).mockResolvedValue({
        error: scenario.error,
        ok: false
      })

      // Clear and fill form
      await user.clear(emailInput)
      await user.clear(passwordInput)
      await user.type(emailInput, `user${i}@example.com`)
      await user.type(passwordInput, `wrongpassword${i}`)

      await act(async () => {
        await user.click(submitButton)
      })

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(screen.getByText(scenario.message)).toBeInTheDocument()
      })

      // Verify no redirect occurred between attempts
      expect(window.location.href).toBe(initialLocation)
    }

    // After all failed attempts, location should still be unchanged
    expect(window.location.href).toBe(initialLocation)
  })

  it("FIXED: Handles the exact callback URL scenario from user report", async () => {
    // Reproduce the exact URL pattern that was problematic:
    // /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F

    // Start with the callback URL that was causing issues
    mockSearchParams.set("callbackUrl", "http://localhost:3000/")

    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
        pathname: "/sign-in",
        search: "?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
        toString: () => "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
      },
      writable: true,
    })

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

    const initialLocation = window.location.href

    await act(async () => {
      await user.click(submitButton)
    })

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // CRITICAL: Location should not change, even with callback URL present
    expect(window.location.href).toBe(initialLocation)
    expect(window.location.pathname).toBe("/sign-in")

    // Error should be visible
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()

    // Verify signIn was called with correct parameters including the callback URL
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "wrongpassword",
      redirect: false, // This is what prevents the redirect
      callbackUrl: "http://localhost:3000/",
    })
  })
})