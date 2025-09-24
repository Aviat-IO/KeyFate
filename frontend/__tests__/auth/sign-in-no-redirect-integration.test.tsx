/**
 * Integration test to verify the specific sign-in redirect issue is fixed
 * This test replicates the exact user experience described in the issue:
 * - User enters incorrect password
 * - Error message should appear and persist
 * - No redirect should occur to /sign-in?callbackUrl=...
 */

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

describe("Sign-In No Redirect Integration Test", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete("error")
    mockSearchParams.delete("callbackUrl")
    mockReplace.mockClear()
    mockPush.mockClear()

    // Mock providers check
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ google: true }),
    })

    // Mock window objects
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-in",
        toString: () => "http://localhost:3000/sign-in",
      },
      writable: true,
    })

    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    })
  })

  it("CRITICAL: Should show persistent error without redirect when incorrect password is entered", async () => {
    // Mock the failed authentication response that reproduces the issue
    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null // Important: no URL to prevent redirect
    })

    await act(async () => {
      render(<SignInPage />)
    })

    const emailInput = screen.getByLabelText("Email")
    const passwordInput = screen.getByLabelText("Password")
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    // User fills in email and incorrect password
    await user.type(emailInput, "user@example.com")
    await user.type(passwordInput, "incorrectpassword")

    // Submit the form
    await act(async () => {
      await user.click(submitButton)
    })

    // CRITICAL CHECKS:
    // 1. Error message should appear and be persistent
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
      expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()
    })

    // 2. No redirect should occur - check all redirect mechanisms
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(window.location.href).toBe("http://localhost:3000/sign-in")

    // 3. Error should persist without flashing
    await new Promise(resolve => setTimeout(resolve, 500)) // Wait to ensure no flash behavior

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Invalid email or password. Please check your credentials and try again.")).toBeInTheDocument()

    // 4. Form should retain the email value (user experience)
    expect(emailInput).toHaveValue("user@example.com")

    // 5. Form should still be functional for retry
    expect(submitButton).not.toBeDisabled()
    expect(submitButton).toHaveTextContent("Sign in")
  })

  it("Should handle the callback URL scenario without redirect on error", async () => {
    // Set up scenario where there's a callback URL that might trigger redirect
    mockSearchParams.set("callbackUrl", "http://localhost:3000/dashboard")

    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: "http://localhost:3000/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fdashboard&error=CredentialsSignin"
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

    // Even with callback URL, should NOT redirect on error
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(window.location.href).toBe("http://localhost:3000/sign-in")

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("Should allow successful authentication to redirect normally", async () => {
    // Verify that successful auth still works correctly
    mockSearchParams.set("callbackUrl", "/dashboard")

    vi.mocked(signIn).mockResolvedValue({
      ok: true,
      error: null,
      status: 200,
      url: null
    })

    // Mock successful redirect
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

    await user.type(emailInput, "user@example.com")
    await user.type(passwordInput, "correctpassword")

    await act(async () => {
      await user.click(submitButton)
    })

    // Should redirect on successful auth
    await waitFor(() => {
      expect(mockLocation.href).toBe("/dashboard")
    })
  })

  it("Should verify signIn is called with redirect: false to prevent automatic redirects", async () => {
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

    // Verify signIn was called with redirect: false
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password",
      redirect: false, // This is critical
      callbackUrl: "/", // Default callback
    })
  })
})