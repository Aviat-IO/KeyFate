import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { NavBar } from "@/components/nav-bar"
import type { User } from "@supabase/supabase-js"

// Mock Next.js router
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock Supabase
const mockSignOut = vi.fn()
vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createClientComponentClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

// Mock ThemeToggle component
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme Toggle</button>,
}))

const mockUser: User = {
  id: "user-123",
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2024-01-01T00:00:00Z",
  phone: "",
  confirmed_at: "2024-01-01T00:00:00Z",
  last_sign_in_at: "2024-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

describe("NavBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("when user is not authenticated", () => {
    it("should render sign in and sign up buttons", () => {
      render(<NavBar user={null} />)

      expect(screen.getByText("Sign In")).toBeInTheDocument()
      expect(screen.getByText("Sign Up")).toBeInTheDocument()
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument()
    })

    it("should render KeyFate logo linking to home", () => {
      render(<NavBar user={null} />)

      const logo = screen.getByText("KeyFate")
      expect(logo).toBeInTheDocument()
      expect(logo.closest("a")).toHaveAttribute("href", "/")
    })

    it("should render theme toggle", () => {
      render(<NavBar user={null} />)

      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument()
    })

    it("should have correct sign in link", () => {
      render(<NavBar user={null} />)

      const signInLink = screen.getByText("Sign In").closest("a")
      expect(signInLink).toHaveAttribute("href", "/auth/login")
    })

    it("should have correct sign up link", () => {
      render(<NavBar user={null} />)

      const signUpLink = screen.getByText("Sign Up").closest("a")
      expect(signUpLink).toHaveAttribute("href", "/auth/signup")
    })
  })

  describe("when user is authenticated", () => {
    it("should render user email and sign out button", () => {
      render(<NavBar user={mockUser} />)

      expect(screen.getByText("test@example.com")).toBeInTheDocument()
      expect(screen.getByText("Sign Out")).toBeInTheDocument()
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument()
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument()
    })

    it("should render KeyFate logo linking to dashboard", () => {
      render(<NavBar user={mockUser} />)

      const logo = screen.getByText("KeyFate")
      expect(logo).toBeInTheDocument()
      expect(logo.closest("a")).toHaveAttribute("href", "/dashboard")
    })

    it("should handle sign out correctly", async () => {
      mockSignOut.mockResolvedValue({ error: null })

      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
      })

      expect(mockRefresh).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith("/auth/login")
    })

    it("should handle sign out error gracefully", async () => {
      mockSignOut.mockResolvedValue({ error: new Error("Sign out failed") })

      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
      })

      // Should still redirect even if there's an error
      expect(mockRefresh).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith("/auth/login")
    })

    it("should render theme toggle when authenticated", () => {
      render(<NavBar user={mockUser} />)

      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument()
    })
  })

  describe("layout and styling", () => {
    it("should have correct navigation structure", () => {
      render(<NavBar user={null} />)

      const nav = screen.getByRole("navigation")
      expect(nav).toHaveClass("bg-background", "border-b")

      const container = nav.querySelector(".container")
      expect(container).toHaveClass(
        "mx-auto",
        "flex",
        "items-center",
        "justify-between",
      )
    })

    it("should have correct button styling", () => {
      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")
      expect(signOutButton).toHaveClass("inline-flex") // Button component class
    })

    it("should display user email with correct styling", () => {
      render(<NavBar user={mockUser} />)

      const emailSpan = screen.getByText("test@example.com")
      expect(emailSpan).toHaveClass("text-muted-foreground", "text-sm")
    })
  })

  describe("edge cases", () => {
    it("should handle undefined user", () => {
      render(<NavBar user={undefined} />)

      expect(screen.getByText("Sign In")).toBeInTheDocument()
      expect(screen.getByText("Sign Up")).toBeInTheDocument()
    })

    it("should handle user without email", () => {
      const userWithoutEmail = { ...mockUser, email: undefined }
      render(<NavBar user={userWithoutEmail as any} />)

      expect(screen.getByText("Sign Out")).toBeInTheDocument()
      // Should not crash when email is undefined
    })

    it("should handle multiple rapid sign out clicks", async () => {
      mockSignOut.mockResolvedValue({ error: null })

      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")

      // Click multiple times rapidly
      fireEvent.click(signOutButton)
      fireEvent.click(signOutButton)
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
      })

      // Should handle multiple clicks gracefully
      expect(mockPush).toHaveBeenCalledWith("/auth/login")
    })
  })

  describe("accessibility", () => {
    it("should have proper navigation landmark", () => {
      render(<NavBar user={null} />)

      const nav = screen.getByRole("navigation")
      expect(nav).toBeInTheDocument()
    })

    it("should have accessible links", () => {
      render(<NavBar user={null} />)

      const links = screen.getAllByRole("link")
      links.forEach((link) => {
        expect(link).toHaveAttribute("href")
      })
    })

    it("should have accessible buttons", () => {
      render(<NavBar user={mockUser} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument()
      })
    })
  })
})
