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

/**
 * CRITICAL BUG REPRODUCTION TEST
 *
 * User reported: Error message flashes briefly then redirects to:
 * /sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F
 *
 * Expected: Error persists without any redirect
 */
describe("CRITICAL: Sign-In Redirect Prevention", () => {
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

    // Mock window location to track any unwanted redirects
    const mockLocation = {
      href: "http://localhost:3000/sign-in",
      pathname: "/sign-in",
      search: "",
      assign: vi.fn(),
      replace: vi.fn(),
      toString: () => "http://localhost:3000/sign-in",
    }

    Object.defineProperty(window, "location", {
      value: mockLocation,
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

  it("CRITICAL: No redirect when NextAuth returns CredentialsSignin error", async () => {
    // Mock the exact failure case reported by user
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

    // Enter incorrect credentials
    await user.type(emailInput, "user@example.com")
    await user.type(passwordInput, "wrongpassword")

    // Track initial location before submission
    const initialHref = window.location.href
    const initialPathname = window.location.pathname

    // Submit the form
    await act(async () => {
      await user.click(submitButton)
    })

    // Verify signIn called with redirect: false
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "wrongpassword",
      redirect: false, // CRITICAL: This should prevent redirects
      callbackUrl: "/",
    })

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // CRITICAL: Verify absolutely no redirect occurred
    expect(window.location.href).toBe(initialHref)
    expect(window.location.pathname).toBe(initialPathname)
    expect(window.location.search).toBe("")

    // Verify no navigation methods were called
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()

    // Verify error message is persistent and correct
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()

    // Verify error doesn't disappear (no flash behavior)
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(window.location.href).toBe(initialHref) // Still no redirect
  })

  it("CRITICAL: Handle callbackUrl without causing unwanted redirects", async () => {
    // Test the specific URL pattern from user's report
    mockSearchParams.set("callbackUrl", "http://localhost:3000/")

    // Update window location to simulate having a callback URL
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

    await act(async () => {
      await user.click(submitButton)
    })

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // Verify signIn called with correct callbackUrl
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "wrongpassword",
      redirect: false,
      callbackUrl: "http://localhost:3000/",
    })

    // CRITICAL: Should stay on sign-in page, not redirect
    expect(window.location.pathname).toBe("/sign-in")

    // Error should be visible
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
  })

  it("CRITICAL: Track all possible redirect mechanisms", async () => {
    // Comprehensive redirect detection
    const redirectAttempts = []

    // Track all redirect methods
    const originalHrefSetter = Object.getOwnPropertyDescriptor(window.location, 'href')?.set
    Object.defineProperty(window.location, 'href', {
      set: (value) => {
        redirectAttempts.push({ type: 'location.href', value })
        if (originalHrefSetter) originalHrefSetter.call(window.location, value)
      },
      get: () => "http://localhost:3000/sign-in"
    })

    window.location.assign = vi.fn((url) => redirectAttempts.push({ type: 'location.assign', value: url }))
    window.location.replace = vi.fn((url) => redirectAttempts.push({ type: 'location.replace', value: url }))

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

    // CRITICAL: No redirect attempts should have been made
    expect(redirectAttempts).toHaveLength(0)
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(window.location.replace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()

    // Error should be visible
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
  })

  it("Error persistence across user interactions", async () => {
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

    // Error should persist while user types new password
    await user.clear(passwordInput)
    await user.type(passwordInput, "newpassword")

    expect(screen.getByRole("alert")).toBeInTheDocument()

    // Error should clear only on new submission with success
    vi.mocked(signIn).mockResolvedValue({ ok: true })

    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })
})