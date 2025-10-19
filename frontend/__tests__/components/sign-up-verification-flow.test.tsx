import { render, screen, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
}))

vi.mock("@/components/auth-form", () => ({
  AuthForm: ({ children, title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <div>{description}</div>
      {children}
    </div>
  ),
}))

global.fetch = vi.fn()

import SignUpPage from "@/app/sign-up/page"

describe("Sign-Up Verification Flow", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete("next")

    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/sign-up",
      },
      writable: true,
    })
  })

  it("should show verification message after successful sign-up", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        user: { id: "user-123", email: "test@example.com", name: null },
        isExistingUser: false,
      }),
    })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "Password123!")
    await user.type(confirmPasswordInput, "Password123!")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument()
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
      expect(
        screen.getByText(/We've sent a verification email/),
      ).toBeInTheDocument()
    })
  })

  it("should not automatically redirect after sign-up", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        user: { id: "user-123", email: "test@example.com", name: null },
        isExistingUser: false,
      }),
    })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "Password123!")
    await user.type(confirmPasswordInput, "Password123!")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument()
    })

    expect(window.location.href).toBe("http://localhost:3000/sign-up")
  })

  it("should display registered email in verification message", async () => {
    const testEmail = "user@test.com"
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        user: { id: "user-123", email: testEmail, name: null },
        isExistingUser: false,
      }),
    })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, testEmail)
    await user.type(passwordInput, "Password123!")
    await user.type(confirmPasswordInput, "Password123!")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/user@test\.com/)).toBeInTheDocument()
    })
  })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, testEmail)
    await user.type(passwordInput, "Password123")
    await user.type(confirmPasswordInput, "Password123")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(
        screen.getByText((content, element) => content.includes(testEmail)),
      ).toBeInTheDocument()
    })
  })

  it("should provide resend verification email option", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        user: { id: "user-123", email: "test@example.com", name: null },
        isExistingUser: false,
      }),
    })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "Password123!")
    await user.type(confirmPasswordInput, "Password123!")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /resend verification email/i }),
      ).toBeInTheDocument()
    })
  })

  it("should handle resend verification email", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          user: { id: "user-123", email: "test@example.com", name: null },
          isExistingUser: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "Password123!")
    await user.type(confirmPasswordInput, "Password123!")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument()
    })

    const resendButton = screen.getByRole("button", {
      name: /resend verification email/i,
    })
    await act(async () => {
      await user.click(resendButton)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/resend-verification",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@example.com" }),
        }),
      )
    })
  })

  it("should show error if resend fails", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          user: { id: "user-123", email: "test@example.com", name: null },
          isExistingUser: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Rate limit exceeded" }),
      })

    await act(async () => {
      render(<SignUpPage />)
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "Password123!")
    await user.type(confirmPasswordInput, "Password123!")
    await act(async () => {
      await user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument()
    })

    const resendButton = screen.getByRole("button", {
      name: /resend verification email/i,
    })
    await act(async () => {
      await user.click(resendButton)
    })

    await waitFor(() => {
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument()
    })
  })
})
