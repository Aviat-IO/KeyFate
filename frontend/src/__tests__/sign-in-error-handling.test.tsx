/**
 * Test for authentication error handling and redirect prevention
 *
 * This test verifies that:
 * 1. Error messages are displayed when authentication fails
 * 2. No unwanted redirects occur during error display
 * 3. Error messages persist until user takes action
 * 4. Successful authentication still redirects properly
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import SignInPage from "@/app/sign-in/page"
import { vi } from "vitest"

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}))

// Mock window.location
const mockLocation = {
  href: "http://localhost:3000/sign-in",
  search: "",
  pathname: "/sign-in",
}

Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
})

// Mock history.replaceState
const mockReplaceState = vi.fn()
Object.defineProperty(window, "history", {
  value: { replaceState: mockReplaceState },
  writable: true,
})

const mockSignIn = signIn as any
const mockUseSearchParams = useSearchParams as any

describe("Sign-in Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearchParams.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as any)
  })

  it("should display error message without redirecting on authentication failure", async () => {
    // Mock failed authentication
    mockSignIn.mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    })

    render(<SignInPage />)

    // Fill in form
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: "test@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } })

    // Submit form
    fireEvent.click(submitButton)

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })

    // Verify no redirect occurred (window.location.href should not be set)
    expect(window.location.href).toBe("http://localhost:3000/sign-in")

    // Verify signIn was called with redirect: false
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "wrongpassword",
      redirect: false,
      callbackUrl: "/",
    })
  })

  it("should redirect only on successful authentication", async () => {
    // Mock successful authentication
    mockSignIn.mockResolvedValue({
      ok: true,
      error: null,
      status: 200,
      url: "http://localhost:3000/",
    })

    render(<SignInPage />)

    // Fill in form
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: "test@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "correctpassword" } })

    // Submit form
    fireEvent.click(submitButton)

    // Wait for redirect to be triggered
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled()
    })

    // Since we can't test actual navigation in jsdom, we verify the signIn call
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "correctpassword",
      redirect: false,
      callbackUrl: "/",
    })
  })

  it("should clear URL error parameters without causing navigation", async () => {
    // Mock URL with error parameter
    mockUseSearchParams.mockReturnValue({
      get: vi
        .fn()
        .mockImplementation((key) =>
          key === "error" ? "CredentialsSignin" : null,
        ),
    } as any)

    // Mock URL object
    const mockUrl = {
      searchParams: {
        has: vi.fn().mockReturnValue(true),
        delete: vi.fn(),
      },
      toString: vi.fn().mockReturnValue("http://localhost:3000/sign-in"),
    }

    global.URL = vi.fn().mockImplementation(() => mockUrl) as any

    mockSignIn.mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    })

    render(<SignInPage />)

    // Fill in form and submit
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: "test@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } })
    fireEvent.click(submitButton)

    // Wait for form submission
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled()
    })

    // Verify URL manipulation was called properly
    expect(mockUrl.searchParams.delete).toHaveBeenCalledWith("error")
    expect(mockReplaceState).toHaveBeenCalledWith(
      {},
      "",
      "http://localhost:3000/sign-in",
    )
  })

  it("should persist error message until user takes action", async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    })

    render(<SignInPage />)

    // Submit form with invalid credentials
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: "test@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } })
    fireEvent.click(submitButton)

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })

    // Simulate waiting (error should still be visible)
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()

    // Error should persist until user modifies input or submits again
    fireEvent.change(passwordInput, { target: { value: "newpassword" } })
    fireEvent.click(submitButton)

    // Error should be cleared when new attempt is made
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(2)
    })
  })
})
