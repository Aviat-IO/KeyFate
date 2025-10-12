import { NavBar } from "@/components/nav-bar"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import * as NextAuth from "next-auth/react"

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

const mockUseSession = vi.fn()
const mockSignOut = vi.fn()
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  SessionProvider: ({ children }: { children: ReactNode }) => children,
  signOut: vi.fn()
}))

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

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme Toggle</button>,
}))

vi.mock("@/components/dev-tier-toggle", () => ({
  DevTierToggle: ({ currentTier }: { currentTier?: "free" | "pro" }) => (
    <button data-testid="dev-tier-toggle">
      {currentTier === "pro" ? "Pro [DEV]" : "Free [DEV]"}
    </button>
  ),
}))

vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon">Menu</span>,
  X: () => <span data-testid="x-icon">X</span>,
  Crown: () => <span data-testid="crown-icon">Crown</span>,
  Check: () => <span data-testid="check-icon">Check</span>,
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
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated"
    })
  })

  it("should render logo linking to home when not authenticated", () => {
    render(<NavBar />)

    const logo = screen.getByText("KeyFate")
    expect(logo).toBeInTheDocument()
    expect(logo.closest("a")).toHaveAttribute("href", "/")
  })

  it("should render logo linking to dashboard when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated"
    })

    render(<NavBar />)

    const logo = screen.getByText("KeyFate")
    expect(logo).toBeInTheDocument()
    expect(logo.closest("a")).toHaveAttribute("href", "/dashboard")
  })

  it("should render theme toggle", () => {
    render(<NavBar />)

    const themeToggle = screen.getByTestId("theme-toggle")
    expect(themeToggle).toBeInTheDocument()
  })

  it("should render mobile menu trigger button", () => {
    render(<NavBar />)

    const mobileMenuTrigger = screen.getByTestId("mobile-menu-trigger")
    expect(mobileMenuTrigger).toBeInTheDocument()
    expect(screen.getByTestId("menu-icon")).toBeInTheDocument()
  })

  it("should show Pro badge when user is pro tier", async () => {
    ;(global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: { name: "pro" } }),
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated"
    })

    render(<NavBar />)

    await waitFor(() => {
      const proButtons = screen.getAllByText("Pro")
      expect(proButtons.length).toBeGreaterThan(0)
    })
  })

  it("should not show Pro badge when user is free tier", async () => {
    ;(global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: { name: "free" } }),
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated"
    })

    render(<NavBar />)

    await waitFor(() => {
      expect(screen.queryByText("Pro")).not.toBeInTheDocument()
    })
  })

  it("should have correct navigation structure", () => {
    render(<NavBar />)

    const nav = screen.getByRole("navigation")
    expect(nav).toHaveClass("bg-background/95", "border-b", "backdrop-blur")

    const container = nav.querySelector(".container")
    expect(container).toHaveClass("mx-auto", "px-4")
  })

  it("should have accessible navigation landmark", () => {
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

  it("should have screen reader text for menu button", () => {
    render(<NavBar />)

    expect(screen.getByText("Open menu")).toBeInTheDocument()
  })
})
