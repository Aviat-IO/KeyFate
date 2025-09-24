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
const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

// Mock fetch for providers check
global.fetch = vi.fn()

// Import the component after mocking
import SignInPage from "@/app/sign-in/page"

describe("Enhanced Sign-In No Redirect Tests", () => {
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

    // Reset navigation mocks
    mockPush.mockClear()
    mockReplace.mockClear()

    // Mock window location
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in",
        pathname: "/sign-in",
        search: "",
        assign: vi.fn(),
        replace: vi.fn(),
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

  it("MUST prevent redirect when signIn fails - comprehensive test", async () => {
    // Test all the different ways NextAuth might try to redirect
    const redirectCalls = []

    // Override signIn to simulate different NextAuth behaviors
    vi.mocked(signIn).mockImplementation(async (provider, options) => {
      // Record the call parameters
      redirectCalls.push({ provider, options })

      // Simulate NextAuth v4 behavior with redirect: false
      if (options?.redirect === false) {
        // This should NOT cause any redirects and should return error info
        return {
          error: "CredentialsSignin",
          ok: false,
          status: 401,
          url: null
        }
      }

      // If redirect is not false, it would normally redirect (but we shouldn't get here)
      throw new Error("signIn called without redirect: false!")
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

    // Verify signIn was called correctly
    expect(redirectCalls).toHaveLength(1)
    expect(redirectCalls[0].options.redirect).toBe(false)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // CRITICAL: No location change should have occurred
    expect(window.location.href).toBe(initialLocation)

    // Error should be persistent
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
  })

  it("MUST handle NextAuth server-side error redirects", async () => {
    // Simulate the case where NextAuth server tries to add error parameters to URL
    // even when we use redirect: false

    vi.mocked(signIn).mockImplementation(async (provider, options) => {
      if (options?.redirect === false) {
        // Even with redirect: false, NextAuth might internally try to redirect
        // We need to ensure our component handles this

        // Simulate what happens when NextAuth adds error params to the URL
        // This mimics the server-side behavior that might be causing the issue
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.set('error', 'CredentialsSignin')
        currentUrl.searchParams.set('callbackUrl', 'http://localhost:3000/')

        // This should NOT happen, but if it does, our component should handle it
        // For testing purposes, we'll simulate this scenario

        return {
          error: "CredentialsSignin",
          ok: false,
          status: 401,
          url: currentUrl.toString() // This simulates NextAuth trying to redirect
        }
      }

      return { error: "Unexpected", ok: false }
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

    // Even if NextAuth tries to provide a redirect URL, our component should ignore it
    expect(window.location.href).toBe(initialLocation)
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
  })

  it("MUST handle the exact redirect pattern from user report", async () => {
    // Reproduce the exact URL pattern reported:
    // /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F

    // Set up the scenario where user starts with a callback URL
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

    // The critical test: location should not change from the initial state
    expect(window.location.href).toBe(initialLocation)
    expect(window.location.pathname).toBe("/sign-in")

    // Error should be visible
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
  })

  it("MUST prevent all forms of automatic navigation", async () => {
    // Comprehensive test to ensure no navigation occurs through any mechanism

    const navigationAttempts = []

    // Mock all possible navigation methods
    const originalHref = window.location.href
    Object.defineProperty(window.location, 'href', {
      set: (value) => {
        navigationAttempts.push({ type: 'location.href', from: originalHref, to: value })
      },
      get: () => originalHref
    })

    window.location.assign = vi.fn((url) => navigationAttempts.push({ type: 'location.assign', to: url }))
    window.location.replace = vi.fn((url) => navigationAttempts.push({ type: 'location.replace', to: url }))

    // Mock Next.js router
    mockPush.mockImplementation((url) => navigationAttempts.push({ type: 'router.push', to: url }))
    mockReplace.mockImplementation((url) => navigationAttempts.push({ type: 'router.replace', to: url }))

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

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // CRITICAL: No navigation attempts should have been made
    expect(navigationAttempts).toHaveLength(0)
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(window.location.replace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()

    // Error should be visible and persistent
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()

    // Test that error persists over time
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})