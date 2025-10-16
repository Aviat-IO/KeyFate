import { render, screen, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { signIn } from "next-auth/react"

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  useSession: vi.fn(() => ({
    data: null,
    status: "unauthenticated",
  })),
}))

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
  useSearchParams: vi.fn(() => mockSearchParams),
  usePathname: vi.fn(() => "/verify-email"),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

global.fetch = vi.fn()

import { EmailVerificationPageNextAuth } from "@/components/auth/email-verification-page-nextauth"

describe("Email Verification Auto-Login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.set("email", "test@example.com")
    mockSearchParams.set("token", "valid-token-123")
  })

  it("should auto-login after successful email verification", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verified: true,
        message: "Email successfully verified",
        sessionToken: "jwt-token-123",
        userId: "user-123",
      }),
    })

    vi.mocked(signIn).mockResolvedValue({
      ok: true,
      error: undefined,
      status: 200,
      url: null,
    })

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/verify-email-nextauth",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            token: "valid-token-123",
            email: "test@example.com",
          }),
        }),
      )
    })

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        verificationToken: "jwt-token-123",
        userId: "user-123",
        redirect: false,
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("should redirect to dashboard after successful auto-login", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verified: true,
        sessionToken: "jwt-token-123",
        userId: "user-123",
      }),
    })

    vi.mocked(signIn).mockResolvedValue({
      ok: true,
      error: undefined,
      status: 200,
      url: null,
    })

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("should handle auto-login failure gracefully", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verified: true,
        sessionToken: "jwt-token-123",
        userId: "user-123",
      }),
    })

    vi.mocked(signIn).mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    })

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(signIn).toHaveBeenCalled()
    })

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/sign-in")
      },
      { timeout: 3000 },
    )
  })

  it("should show success message during auto-login", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verified: true,
        sessionToken: "jwt-token-123",
        userId: "user-123",
      }),
    })

    vi.mocked(signIn).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                error: undefined,
                status: 200,
                url: null,
              }),
            100,
          ),
        ),
    )

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(screen.getByText("Email Verified!")).toBeInTheDocument()
    })
  })

  it("should handle verification without session token", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verified: true,
        message: "Email successfully verified",
      }),
    })

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(screen.getByText("Email Verified!")).toBeInTheDocument()
    })

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/sign-in")
      },
      { timeout: 3000 },
    )

    expect(signIn).not.toHaveBeenCalled()
  })

  it("should show error message when verification fails", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "Invalid or expired verification token",
      }),
    })

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(
        screen.getByText("Invalid or expired verification token"),
      ).toBeInTheDocument()
    })

    expect(signIn).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("should handle network errors during verification", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"))

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(
        screen.getByText("Network error. Please try again."),
      ).toBeInTheDocument()
    })

    expect(signIn).not.toHaveBeenCalled()
  })

  it("should use custom callback URL if provided", async () => {
    mockSearchParams.set("callbackUrl", "/custom-page")

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verified: true,
        sessionToken: "jwt-token-123",
        userId: "user-123",
      }),
    })

    vi.mocked(signIn).mockResolvedValue({
      ok: true,
      error: undefined,
      status: 200,
      url: null,
    })

    await act(async () => {
      render(<EmailVerificationPageNextAuth />)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/custom-page")
    })
  })
})
