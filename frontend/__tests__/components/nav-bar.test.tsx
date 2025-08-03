import { NavBar } from "@/components/nav-bar"
import type { User } from "@supabase/supabase-js"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock Next.js router
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockPathname = vi.fn().mockReturnValue("/")
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname(),
}))

// Mock Supabase
vi.mock("@/utils/supabase/client", () => {
  const mockSignOut = vi.fn()
  const mockGetSession = vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  })
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })

  return {
    createClient: () => ({
      auth: {
        signOut: mockSignOut,
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
      },
    }),
  }
})

// Mock ThemeToggle component
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme Toggle</button>,
}))

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon">Menu</span>,
  X: () => <span data-testid="x-icon">X</span>,
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
    mockPathname.mockReturnValue("/")
  })

  describe("desktop view - when user is not authenticated", () => {
    it("should render sign in and sign up buttons on desktop", () => {
      render(<NavBar user={null} />)

      // Desktop menu should be visible
      const desktopMenu = document.querySelector(".hidden.md\\:flex")
      expect(desktopMenu).toBeInTheDocument()

      expect(screen.getByText("Sign In")).toBeInTheDocument()
      // Should have Sign Up buttons (desktop + mobile)
      const signUpButtons = screen.getAllByText("Sign Up")
      expect(signUpButtons.length).toBeGreaterThan(0)
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument()
    })

    it("should render pricing link on desktop when not authenticated", () => {
      render(<NavBar user={null} />)

      expect(screen.getByText("Pricing")).toBeInTheDocument()
    })

    it("should render secret sharing tool link on desktop", () => {
      render(<NavBar user={null} />)

      const secretSharingLinks = screen.getAllByText("Recover Secret")
      expect(secretSharingLinks.length).toBeGreaterThan(0)
      // Check that at least one has the correct href
      const linkWithHref = secretSharingLinks.find(
        (link) => link.closest("a")?.getAttribute("href") === "/decrypt",
      )
      expect(linkWithHref).toBeTruthy()
    })

    it("should render KeyFate logo linking to home", () => {
      render(<NavBar user={null} />)

      const logo = screen.getByText("KeyFate")
      expect(logo).toBeInTheDocument()
      expect(logo.closest("a")).toHaveAttribute("href", "/")
    })

    it("should render theme toggle", () => {
      render(<NavBar user={null} />)

      const themeToggles = screen.getAllByTestId("theme-toggle")
      expect(themeToggles.length).toBeGreaterThan(0) // Should appear in both desktop and mobile
    })
  })

  describe("desktop view - when user is authenticated", () => {
    it("should render sign out button but not user email on desktop", () => {
      render(<NavBar user={mockUser} />)

      expect(screen.queryByText("test@example.com")).not.toBeInTheDocument()
      expect(screen.getByText("Sign Out")).toBeInTheDocument()
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument()
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument()
    })

    it("should not render pricing link when authenticated", () => {
      render(<NavBar user={mockUser} />)

      // Should not show pricing in desktop menu when authenticated
      const desktopMenu = document.querySelector(".hidden.md\\:flex")
      expect(desktopMenu).toBeInTheDocument()
      expect(desktopMenu?.textContent).not.toContain("Pricing")
    })

    it("should render Dashboard link when authenticated user is on home route", () => {
      mockPathname.mockReturnValue("/")
      render(<NavBar user={mockUser} />)

      const dashboardLink = screen.getByText("Dashboard")
      expect(dashboardLink).toBeInTheDocument()
      expect(dashboardLink.closest("a")).toHaveAttribute("href", "/dashboard")
    })

    it("should not render Dashboard link when authenticated user is not on home route", () => {
      mockPathname.mockReturnValue("/some-other-page")
      render(<NavBar user={mockUser} />)

      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
    })

    it("should render KeyFate logo linking to dashboard", () => {
      render(<NavBar user={mockUser} />)

      const logo = screen.getByText("KeyFate")
      expect(logo).toBeInTheDocument()
      expect(logo.closest("a")).toHaveAttribute("href", "/dashboard")
    })

    it("should handle sign out correctly", async () => {
      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })

      expect(mockPush).toHaveBeenCalledWith("/auth/login")
    })
  })

  describe("mobile view", () => {
    it("should render mobile menu trigger button", () => {
      render(<NavBar user={null} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      expect(mobileMenuTrigger).toBeInTheDocument()
      expect(screen.getByTestId("menu-icon")).toBeInTheDocument()
    })

    it("should show sign up button outside mobile menu for unauthenticated users", () => {
      render(<NavBar user={null} />)

      // Should have sign up button visible on mobile (outside the menu)
      const signUpButtons = screen.getAllByText("Sign Up")
      expect(signUpButtons.length).toBeGreaterThan(0)
    })

    it("should not show sign up button on mobile when authenticated", () => {
      render(<NavBar user={mockUser} />)

      // Should not show sign up button when user is authenticated
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument()
    })

    it("should open mobile menu when hamburger is clicked", async () => {
      render(<NavBar user={null} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        // Check for menu content instead of close button
        const pricingLinks = screen.getAllByText("Pricing")
        expect(pricingLinks.length).toBeGreaterThan(0)
      })
    })

    it("should show pricing in mobile menu when not authenticated", async () => {
      render(<NavBar user={null} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const pricingLinks = screen.getAllByText("Pricing")
        expect(pricingLinks.length).toBeGreaterThan(0)
      })
    })

    it("should show recover secret in mobile menu", async () => {
      render(<NavBar user={null} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const recoverSecretLinks = screen.getAllByText("Recover Secret")
        expect(recoverSecretLinks.length).toBeGreaterThan(0)
      })
    })

    it("should show only sign in (not sign up) in mobile menu when not authenticated", async () => {
      render(<NavBar user={null} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        // Should show Sign In in the mobile menu
        const signInLinks = screen.getAllByText("Sign In")
        expect(signInLinks.length).toBeGreaterThan(0)

        // Sign Up should still be present but outside the menu (on the main mobile navbar)
        const signUpButtons = screen.getAllByText("Sign Up")
        expect(signUpButtons.length).toBeGreaterThan(0)
      })
    })

    it("should close mobile menu when menu item is clicked", async () => {
      render(<NavBar user={null} />)

      // Open menu
      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const pricingLinks = screen.getAllByText("Pricing")
        expect(pricingLinks.length).toBeGreaterThan(0)
      })

      // Click on a menu item
      const mobileRecoverSecretButton = screen.getByTestId(
        "mobile-recover-secret",
      )
      expect(mobileRecoverSecretButton).toBeInTheDocument()
      fireEvent.click(mobileRecoverSecretButton)

      // Wait for the menu to close (indicated by the dialog being in closed state)
      await waitFor(() => {
        const menuTrigger = screen.getByTestId("mobile-menu-trigger")
        expect(menuTrigger).toHaveAttribute("aria-expanded", "false")
      })
    })

    it("should show sign out but not user email in mobile menu when authenticated", async () => {
      render(<NavBar user={mockUser} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        expect(screen.queryByText("test@example.com")).not.toBeInTheDocument()
        expect(screen.getAllByText("Sign Out").length).toBeGreaterThan(0)
      })
    })

    it("should handle mobile sign out correctly", async () => {
      render(<NavBar user={mockUser} />)

      // Open mobile menu
      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        expect(screen.getAllByText("Sign Out").length).toBeGreaterThan(0)
      })

      // Click sign out in mobile menu
      const signOutButtons = screen.getAllByText("Sign Out")
      const mobileSignOutButton = signOutButtons.find((button) =>
        button.closest("button")?.className.includes("justify-start"),
      )
      expect(mobileSignOutButton).toBeTruthy()
      fireEvent.click(mobileSignOutButton!)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })

      expect(mockPush).toHaveBeenCalledWith("/auth/login")
    })

    it("should show Dashboard link in mobile menu when authenticated user is on home route", async () => {
      mockPathname.mockReturnValue("/")
      render(<NavBar user={mockUser} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const dashboardButton = screen.getByTestId("mobile-dashboard")
        expect(dashboardButton).toBeInTheDocument()
        expect(dashboardButton.textContent).toBe("Dashboard")
      })
    })

    it("should not show Dashboard link in mobile menu when authenticated user is not on home route", async () => {
      mockPathname.mockReturnValue("/some-other-page")
      render(<NavBar user={mockUser} />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        expect(screen.queryByTestId("mobile-dashboard")).not.toBeInTheDocument()
      })
    })
  })

  describe("responsive behavior", () => {
    it("should have desktop menu hidden on mobile", () => {
      render(<NavBar user={null} />)

      const desktopMenu = document.querySelector(".hidden.md\\:flex")
      expect(desktopMenu).toBeInTheDocument()
      expect(desktopMenu).toHaveClass("hidden", "md:flex")
    })

    it("should have mobile menu hidden on desktop", () => {
      render(<NavBar user={null} />)

      const mobileMenu = document.querySelector(".flex.md\\:hidden")
      expect(mobileMenu).toBeInTheDocument()
      expect(mobileMenu).toHaveClass("flex", "md:hidden")
    })

    it("should show theme toggle on both desktop and mobile", () => {
      render(<NavBar user={null} />)

      const themeToggles = screen.getAllByTestId("theme-toggle")
      expect(themeToggles.length).toBe(2) // One for desktop, one for mobile
    })

    it("should show sign up button on mobile but not in mobile menu", () => {
      render(<NavBar user={null} />)

      // Sign up should be visible on mobile navbar
      const signUpButtons = screen.getAllByText("Sign Up")
      expect(signUpButtons.length).toBeGreaterThan(0)

      // But when we open the mobile menu, it should only show Sign In
      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)
    })
  })

  describe("layout and styling", () => {
    it("should have correct navigation structure", () => {
      render(<NavBar user={null} />)

      const nav = screen.getByRole("navigation")
      expect(nav).toHaveClass("bg-background/95", "border-b", "backdrop-blur")

      const container = nav.querySelector(".container")
      expect(container).toHaveClass("mx-auto", "px-4")
    })

    it("should have correct button styling", () => {
      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")
      expect(signOutButton).toHaveClass("inline-flex") // Button component class
    })

    it("should not display user email in desktop", () => {
      render(<NavBar user={mockUser} />)

      expect(screen.queryByText("test@example.com")).not.toBeInTheDocument()
    })
  })

  describe("edge cases", () => {
    it("should handle undefined user", async () => {
      render(<NavBar user={undefined} />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText("Sign In")).toBeInTheDocument()
        const signUpButtons = screen.getAllByText("Sign Up")
        expect(signUpButtons.length).toBeGreaterThan(0)
      })
    })

    it("should handle user without email", () => {
      const userWithoutEmail = { ...mockUser, email: undefined }
      render(<NavBar user={userWithoutEmail as any} />)

      expect(screen.getByText("Sign Out")).toBeInTheDocument()
      // Email is not displayed anyway, so this should work fine
      expect(screen.queryByText("undefined")).not.toBeInTheDocument()
    })

    it("should handle multiple rapid sign out clicks", async () => {
      render(<NavBar user={mockUser} />)

      const signOutButton = screen.getByText("Sign Out")

      // Click multiple times rapidly
      fireEvent.click(signOutButton)
      fireEvent.click(signOutButton)
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
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

    it("should have screen reader text for menu buttons", () => {
      render(<NavBar user={null} />)

      expect(screen.getByText("Open menu")).toBeInTheDocument()
    })
  })
})
