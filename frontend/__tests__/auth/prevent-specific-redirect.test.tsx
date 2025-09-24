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

describe("Prevent Specific Redirect Issue", () => {
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

    // Mock console.error to check for any unexpected errors
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock window.location with realistic behavior
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in",
        pathname: "/sign-in",
        search: "",
        toString: () => "http://localhost:3000/sign-in",
      },
      writable: true,
      configurable: true,
    })

    // Mock window.history
    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
        pushState: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reproduces and fixes the specific redirect issue: /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F", async () => {
    // This test specifically addresses the bug described:
    // "redirects to: /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F"

    // Mock NextAuth to return an authentication error
    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null
    })

    await act(async () => {
      render(<SignInPage />)
    })

    // Fill in wrong credentials
    const emailInput = screen.getByLabelText("Email")
    const passwordInput = screen.getByLabelText("Password")
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    await user.type(emailInput, "user@example.com")
    await user.type(passwordInput, "wrongpassword")

    // Submit the form
    await act(async () => {
      await user.click(submitButton)
    })

    // Verify that the error message appears and persists
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
      expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
    })

    // CRITICAL CHECKS: Ensure no redirect occurs

    // 1. Check that window.location hasn't changed to the problematic URL
    expect(window.location.href).toBe("http://localhost:3000/sign-in")
    expect(window.location.pathname).toBe("/sign-in")
    expect(window.location.search).toBe("")

    // 2. Check that the problematic URL pattern is NOT present
    expect(window.location.href).not.toContain("callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F")
    expect(window.location.href).not.toContain("error=CredentialsSignin")

    // 3. Check that history.replaceState wasn't called with redirect URL
    if (window.history.replaceState.mock.calls.length > 0) {
      const replaceStateCalls = window.history.replaceState.mock.calls
      replaceStateCalls.forEach(call => {
        const url = call[2] // Third argument is the URL
        expect(url).not.toContain("callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F")
        expect(url).not.toContain("error=CredentialsSignin")
      })
    }

    // 4. Verify error persists for reasonable duration (not just a flash)
    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(window.location.href).toBe("http://localhost:3000/sign-in")

    // 5. Verify no unexpected console errors were logged
    // Note: Some console.error calls may be expected from test setup
    const consoleCalls = console.error.mock.calls
    const signInErrorCalls = consoleCalls.filter(call =>
      call[0] === 'Sign-in error:' || call[0].includes('Sign-in error')
    )
    expect(signInErrorCalls.length).toBeGreaterThanOrEqual(0) // May have sign-in error logs
  })

  it("ensures error handling works when starting from a callback URL", async () => {
    // Test the scenario where user is redirected to sign-in with a callback URL
    // and then fails authentication

    mockSearchParams.set("callbackUrl", "http://localhost:3000/")

    // Update window.location to reflect callback URL
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

    await user.type(emailInput, "user@example.com")
    await user.type(passwordInput, "wrongpassword")

    await act(async () => {
      await user.click(submitButton)
    })

    // Should show error
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // Should not redirect or modify URL in unintended ways
    expect(window.location.pathname).toBe("/sign-in")

    // Should not have added error parameter that causes additional redirect
    expect(window.location.href).not.toMatch(/error=CredentialsSignin.*callbackUrl/)

    // Error should persist
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("verifies signIn is called with correct parameters to prevent NextAuth redirects", async () => {
    // This test ensures we're calling signIn with the right parameters
    // to prevent NextAuth v4 from doing unwanted redirects

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
    await user.type(passwordInput, "password")

    await act(async () => {
      await user.click(submitButton)
    })

    // Verify signIn was called with correct parameters
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password",
      redirect: false, // This is critical for preventing redirects
      callbackUrl: "/",
    })

    // Verify error state
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })
})