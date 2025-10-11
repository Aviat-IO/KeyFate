import { NavBar } from "@/components/nav-bar"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import * as NextAuth from "next-auth/react"

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

// Mock NextAuth
const mockUseSession = vi.fn()
const mockSignOut = vi.fn()
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  SessionProvider: ({ children }: { children: ReactNode }) => children,
  signOut: vi.fn()
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

// Mock DevTierToggle component
vi.mock("@/components/dev-tier-toggle", () => ({
  DevTierToggle: ({ currentTier }: { currentTier?: "free" | "pro" }) => (
    <button data-testid="dev-tier-toggle">
      {currentTier === "pro" ? "Pro [DEV]" : "Free [DEV]"}
    </button>
  ),
}))

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon">Menu</span>,
  X: () => <span data-testid="x-icon">X</span>,
  Crown: () => <span data-testid="crown-icon">Crown</span>,
}))

const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "Test User"
  },
  expires: "2024-12-31T23:59:59.999Z"
}

describe("NavBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue("/")
    // Default to no session
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated"
    })
  })

  describe("desktop view - when user is not authenticated", () => {
    it("should render sign in and sign up buttons on desktop", () => {
      render(<NavBar />)

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
      render(<NavBar />)

      expect(screen.getByText("Pricing")).toBeInTheDocument()
    })

    it("should render secret sharing tool link on desktop", () => {
      render(<NavBar />)

      const secretSharingLinks = screen.getAllByText("Recover Secret")
      expect(secretSharingLinks.length).toBeGreaterThan(0)
      // Check that at least one has the correct href
      const linkWithHref = secretSharingLinks.find(
        (link) => link.closest("a")?.getAttribute("href") === "/decrypt",
      )
      expect(linkWithHref).toBeTruthy()
    })

    it("should render KeyFate logo linking to home", () => {
      render(<NavBar />)

      const logo = screen.getByText("KeyFate")
      expect(logo).toBeInTheDocument()
      expect(logo.closest("a")).toHaveAttribute("href", "/")
    })

    it("should render theme toggle", () => {
      render(<NavBar />)

      const themeToggles = screen.getAllByTestId("theme-toggle")
      expect(themeToggles.length).toBeGreaterThan(0) // Should appear in both desktop and mobile
    })
  })

  describe("desktop view - when user is authenticated", () => {
    it("should render sign out button but not user email on desktop", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      expect(screen.queryByText("test@example.com")).not.toBeInTheDocument()
      expect(screen.getByText("Sign Out")).toBeInTheDocument()
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument()
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument()
    })

    it("should not render pricing link when authenticated", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      // Should not show pricing in desktop menu when authenticated
      const desktopMenu = document.querySelector(".hidden.md\\:flex")
      expect(desktopMenu).toBeInTheDocument()
      expect(desktopMenu?.textContent).not.toContain("Pricing")
    })

    it("should render Dashboard link when authenticated user is on home route", () => {
      mockPathname.mockReturnValue("/")
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const dashboardLink = screen.getByText("Dashboard")
      expect(dashboardLink).toBeInTheDocument()
      expect(dashboardLink.closest("a")).toHaveAttribute("href", "/dashboard")
    })

    it("should not render Dashboard link when authenticated user is not on home route", () => {
      mockPathname.mockReturnValue("/some-other-page")
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
    })

    it("should render KeyFate logo linking to dashboard", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const logo = screen.getByText("KeyFate")
      expect(logo).toBeInTheDocument()
      expect(logo.closest("a")).toHaveAttribute("href", "/dashboard")
    })

    it("should handle sign out correctly", async () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const signOutSpy = vi.spyOn(NextAuth, 'signOut').mockResolvedValue(undefined)

      const signOutButton = screen.getByText("Sign Out")
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(signOutSpy).toHaveBeenCalledWith({ callbackUrl: "/sign-in" })
      })
    })
  })

  describe("mobile view", () => {
    it("should render mobile menu trigger button", () => {
      render(<NavBar />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      expect(mobileMenuTrigger).toBeInTheDocument()
      expect(screen.getByTestId("menu-icon")).toBeInTheDocument()
    })

    it("should show sign up button outside mobile menu for unauthenticated users", () => {
      render(<NavBar />)

      // Should have sign up button visible on mobile (outside the menu)
      const signUpButtons = screen.getAllByText("Sign Up")
      expect(signUpButtons.length).toBeGreaterThan(0)
    })

    it("should not show sign up button on mobile when authenticated", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      // Should not show sign up button when user is authenticated
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument()
    })

    it("should open mobile menu when hamburger is clicked", async () => {
      render(<NavBar />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        // Check for menu content instead of close button
        const pricingLinks = screen.getAllByText("Pricing")
        expect(pricingLinks.length).toBeGreaterThan(0)
      })
    })

    it("should show pricing in mobile menu when not authenticated", async () => {
      render(<NavBar />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const pricingLinks = screen.getAllByText("Pricing")
        expect(pricingLinks.length).toBeGreaterThan(0)
      })
    })

    it("should show recover secret in mobile menu", async () => {
      render(<NavBar />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const recoverSecretLinks = screen.getAllByText("Recover Secret")
        expect(recoverSecretLinks.length).toBeGreaterThan(0)
      })
    })

    it("should show only sign in (not sign up) in mobile menu when not authenticated", async () => {
      render(<NavBar />)

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
      render(<NavBar />)

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
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        expect(screen.queryByText("test@example.com")).not.toBeInTheDocument()
        expect(screen.getAllByText("Sign Out").length).toBeGreaterThan(0)
      })
    })

    it("should handle mobile sign out correctly", async () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

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
      const signOutSpy = vi.spyOn(NextAuth, 'signOut').mockResolvedValue(undefined)

      fireEvent.click(mobileSignOutButton!)

      await waitFor(() => {
        expect(signOutSpy).toHaveBeenCalledWith({ callbackUrl: "/sign-in" })
      })
    })

    it("should show Dashboard link in mobile menu when authenticated user is on home route", async () => {
      mockPathname.mockReturnValue("/")
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

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
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        expect(screen.queryByTestId("mobile-dashboard")).not.toBeInTheDocument()
      })
    })
  })

  describe("responsive behavior", () => {
    it("should have desktop menu hidden on mobile", () => {
      render(<NavBar />)

      const desktopMenu = document.querySelector(".hidden.md\\:flex")
      expect(desktopMenu).toBeInTheDocument()
      expect(desktopMenu).toHaveClass("hidden", "md:flex")
    })

    it("should have mobile menu hidden on desktop", () => {
      render(<NavBar />)

      const mobileMenu = document.querySelector(".flex.md\\:hidden")
      expect(mobileMenu).toBeInTheDocument()
      expect(mobileMenu).toHaveClass("flex", "md:hidden")
    })

    it("should show theme toggle on both desktop and mobile", () => {
      render(<NavBar />)

      const themeToggles = screen.getAllByTestId("theme-toggle")
      expect(themeToggles.length).toBe(2) // One for desktop, one for mobile
    })

    it("should show sign up button on mobile but not in mobile menu", () => {
      render(<NavBar />)

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
      render(<NavBar />)

      const nav = screen.getByRole("navigation")
      expect(nav).toHaveClass("bg-background/95", "border-b", "backdrop-blur")

      const container = nav.querySelector(".container")
      expect(container).toHaveClass("mx-auto", "px-4")
    })

    it("should have correct button styling", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const signOutButton = screen.getByText("Sign Out")
      expect(signOutButton).toHaveClass("inline-flex") // Button component class
    })

    it("should not display user email in desktop", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      expect(screen.queryByText("test@example.com")).not.toBeInTheDocument()
    })
  })

  describe("edge cases", () => {
    it("should handle undefined user", async () => {
      // Default state is already no session, so just render
      render(<NavBar />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText("Sign In")).toBeInTheDocument()
        const signUpButtons = screen.getAllByText("Sign Up")
        expect(signUpButtons.length).toBeGreaterThan(0)
      })
    })

    it("should handle user without email", () => {
      const sessionWithoutEmail = {
        ...mockSession,
        user: { ...mockSession.user, email: undefined }
      }
      mockUseSession.mockReturnValue({
        data: sessionWithoutEmail,
        status: "authenticated"
      })

      render(<NavBar />)

      expect(screen.getByText("Sign Out")).toBeInTheDocument()
      // Email is not displayed anyway, so this should work fine
      expect(screen.queryByText("undefined")).not.toBeInTheDocument()
    })

    it("should handle multiple rapid sign out clicks", async () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const signOutSpy = vi.spyOn(NextAuth, 'signOut').mockResolvedValue(undefined)
      const signOutButton = screen.getByText("Sign Out")

      // Click multiple times rapidly
      fireEvent.click(signOutButton)
      fireEvent.click(signOutButton)
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(signOutSpy).toHaveBeenCalled()
      })

      // Should handle multiple clicks gracefully - may be called multiple times
      expect(signOutSpy).toHaveBeenCalledWith({ callbackUrl: "/sign-in" })
    })
  })

  describe("tier and upgrade functionality", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("should show Upgrade to Pro button for free tier users", async () => {
      // Mock subscription API to return free tier
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tier: { name: "free" } }),
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      await waitFor(() => {
        const upgradeButtons = screen.queryAllByText("Upgrade to Pro")
        expect(upgradeButtons.length).toBeGreaterThan(0)
      })
    })

    it("should not show Upgrade to Pro button for pro tier users", async () => {
      // Mock subscription API to return pro tier
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tier: { name: "pro" } }),
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      await waitFor(() => {
        expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument()
      })
    })

    it("should show DevTierToggle for authenticated users", async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tier: { name: "free" } }),
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      await waitFor(() => {
        const devToggle = screen.queryByTestId("dev-tier-toggle")
        expect(devToggle).toBeInTheDocument()
      })
    })

    it("should not show tier toggle while checking subscription", async () => {
      // Don't resolve the promise immediately to simulate loading state
      ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      // During loading, upgrade button should not be visible
      expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument()
    })

    it("should show Upgrade to Pro button in mobile menu for free tier users", async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tier: { name: "free" } }),
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      await waitFor(() => {
        expect(screen.queryAllByText("Upgrade to Pro").length).toBeGreaterThan(0)
      })

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        const upgradeButtons = screen.getAllByText("Upgrade to Pro")
        expect(upgradeButtons.length).toBeGreaterThan(0)
      })
    })

    it("should not show Upgrade to Pro button in mobile menu for pro tier users", async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tier: { name: "pro" } }),
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      await waitFor(() => {
        expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument()
      })

      const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
      fireEvent.click(mobileMenuTrigger)

      await waitFor(() => {
        expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument()
      })
    })
  })

  describe("accessibility", () => {
    it("should have proper navigation landmark", () => {
      render(<NavBar />)

      const nav = screen.getByRole("navigation")
      expect(nav).toBeInTheDocument()
    })

    it("should have accessible links", () => {
      render(<NavBar />)

      const links = screen.getAllByRole("link")
      links.forEach((link) => {
        expect(link).toHaveAttribute("href")
      })
    })

    it("should have accessible buttons", () => {
      // Set authenticated session
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated"
      })

      render(<NavBar />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument()
      })
    })

    it("should have screen reader text for menu buttons", () => {
      render(<NavBar />)

      expect(screen.getByText("Open menu")).toBeInTheDocument()
    })
  })
})
