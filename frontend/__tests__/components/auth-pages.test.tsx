import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the auth utilities
vi.mock("@/lib/auth", () => ({
  completeAuthFlow: vi.fn(),
}))

// Mock Next.js router
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase client
const mockVerifyOtp = vi.fn()
const mockSupabaseClient = {
  auth: {
    verifyOtp: mockVerifyOtp,
  },
}

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => mockSupabaseClient,
}))

// Import the pages after mocking
import UpdatePasswordPage from "@/app/auth/update-password/page"
import VerifyPage from "@/app/auth/verify/page"

describe("Auth Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.location.hash
    Object.defineProperty(window, "location", {
      value: {
        hash: "#access_token=test-access&refresh_token=test-refresh",
        pathname: "/auth/verify",
      },
      writable: true,
    })
  })

  describe("VerifyPage", () => {
    it("should render loading state initially", () => {
      render(<VerifyPage />)

      expect(screen.getByText("Verifying your email...")).toBeInTheDocument()
      expect(
        screen.getByText("Please wait while we verify your email address."),
      ).toBeInTheDocument()
    })

    it("should handle successful auth flow", async () => {
      const { completeAuthFlow } = await import("@/lib/auth")
      ;(completeAuthFlow as any).mockResolvedValue({
        success: true,
        data: { user: { id: "user-123" } },
      })

      render(<VerifyPage />)

      await waitFor(() => {
        expect(completeAuthFlow).toHaveBeenCalledWith(
          "#access_token=test-access&refresh_token=test-refresh",
        )
        expect(mockPush).toHaveBeenCalledWith("/dashboard")
      })
    })

    it("should handle failed auth flow", async () => {
      const { completeAuthFlow } = await import("@/lib/auth")
      ;(completeAuthFlow as any).mockResolvedValue({
        success: false,
        error: "Invalid verification link",
      })

      // Suppress expected console error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      render(<VerifyPage />)

      await waitFor(() => {
        expect(completeAuthFlow).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith(
          "/auth/login?error=Email verification failed. Please try again.",
        )
      })

      // Restore console.error
      consoleSpy.mockRestore()
    })

    it("should handle auth flow exception", async () => {
      const { completeAuthFlow } = await import("@/lib/auth")
      ;(completeAuthFlow as any).mockRejectedValue(new Error("Network error"))

      // Suppress expected console error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      render(<VerifyPage />)

      await waitFor(() => {
        expect(completeAuthFlow).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith(
          "/auth/login?error=Email verification failed. Please try again.",
        )
      })

      // Restore console.error
      consoleSpy.mockRestore()
    })
  })

  describe("UpdatePasswordPage", () => {
    it("should render loading state initially", () => {
      render(<UpdatePasswordPage />)

      expect(screen.getByText("Update your password")).toBeInTheDocument()
      expect(
        screen.getByText("Verifying your reset link..."),
      ).toBeInTheDocument()
    })

    it("should show error for invalid reset link", async () => {
      Object.defineProperty(window, "location", {
        value: {
          hash: "", // No tokens
          pathname: "/auth/update-password",
        },
        writable: true,
      })

      render(<UpdatePasswordPage />)

      await waitFor(() => {
        expect(
          screen.getByText("Invalid password reset link"),
        ).toBeInTheDocument()
      })
    })

    it("should show password form after successful auth flow", async () => {
      const { completeAuthFlow } = await import("@/lib/auth")
      ;(completeAuthFlow as any).mockResolvedValue({
        success: true,
        data: { user: { id: "user-123" } },
      })

      render(<UpdatePasswordPage />)

      await waitFor(() => {
        expect(
          screen.getByText("Enter your new password below"),
        ).toBeInTheDocument()
        expect(screen.getByPlaceholderText("New password")).toBeInTheDocument()
        expect(
          screen.getByPlaceholderText("Confirm new password"),
        ).toBeInTheDocument()
      })
    })

    it("should show error for failed auth flow", async () => {
      const { completeAuthFlow } = await import("@/lib/auth")
      ;(completeAuthFlow as any).mockResolvedValue({
        success: false,
        error: "Invalid password reset link",
      })

      render(<UpdatePasswordPage />)

      await waitFor(() => {
        expect(
          screen.getByText("Invalid password reset link"),
        ).toBeInTheDocument()
      })
    })

    it("should handle auth flow exception", async () => {
      const { completeAuthFlow } = await import("@/lib/auth")
      ;(completeAuthFlow as any).mockRejectedValue(new Error("Network error"))

      render(<UpdatePasswordPage />)

      await waitFor(() => {
        expect(
          screen.getByText("Invalid password reset link"),
        ).toBeInTheDocument()
      })
    })
  })
})
