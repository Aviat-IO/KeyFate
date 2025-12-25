import HomePage from "@/app/page"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: null,
    status: "unauthenticated",
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/nav-bar", () => ({
  NavBar: () => <div data-testid="navbar">NavBar</div>,
}))

vi.mock("@/components/footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}))

vi.mock("lucide-react", () => ({
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Lock: () => <span data-testid="icon-lock">Lock</span>,
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  FileText: () => <span data-testid="icon-filetext">FileText</span>,
  Key: () => <span data-testid="icon-key">Key</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  CheckCircle: () => <span data-testid="icon-checkcircle">CheckCircle</span>,
  Eye: () => <span data-testid="icon-eye">Eye</span>,
  EyeOff: () => <span data-testid="icon-eyeoff">EyeOff</span>,
  ArrowRight: () => <span data-testid="icon-arrowright">ArrowRight</span>,
  Zap: () => <span data-testid="icon-zap">Zap</span>,
  Globe: () => <span data-testid="icon-globe">Globe</span>,
}))

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render the page with navbar and footer", () => {
    render(<HomePage />)

    expect(screen.getByTestId("navbar")).toBeInTheDocument()
    expect(screen.getByTestId("footer")).toBeInTheDocument()
  })

  it("should have a fixed navbar with glass effect", () => {
    const { container } = render(<HomePage />)

    const navContainer = container.querySelector("nav")
    expect(navContainer).toBeInTheDocument()
    expect(navContainer).toHaveClass("fixed")
    expect(navContainer).toHaveClass("top-0")
    expect(navContainer).toHaveClass("left-0")
    expect(navContainer).toHaveClass("right-0")
    expect(navContainer).toHaveClass("z-50")
    expect(navContainer).toHaveClass("backdrop-blur-md")
  })

  it("should have navbar offset spacer", () => {
    const { container } = render(<HomePage />)

    const spacer = container.querySelector(".h-16")
    expect(spacer).toBeInTheDocument()
  })

  it("should render hero section with main headline", () => {
    render(<HomePage />)

    // Multiple elements contain "Your Digital", so use getAllByText
    const yourDigitalElements = screen.getAllByText(/Your Digital/)
    expect(yourDigitalElements.length).toBeGreaterThan(0)
    expect(screen.getByText("Legacy")).toBeInTheDocument()
    // "Protected" may be part of h1 with varied whitespace
    expect(screen.getByText(/Protected/)).toBeInTheDocument()
  })

  it("should render call-to-action buttons", () => {
    render(<HomePage />)

    expect(
      screen.getByRole("link", { name: /Start Protecting Your Secrets/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /See How It Works/i })
    ).toBeInTheDocument()
  })

  it("should render trust indicators", () => {
    render(<HomePage />)

    expect(screen.getByText("Client-side encryption")).toBeInTheDocument()
    expect(screen.getByText("Zero-knowledge architecture")).toBeInTheDocument()
    expect(screen.getByText("Open source cryptography")).toBeInTheDocument()
  })

  it("should render use cases section", () => {
    render(<HomePage />)

    expect(screen.getByText("Cryptocurrency Holders")).toBeInTheDocument()
    expect(screen.getByText("Journalists & Activists")).toBeInTheDocument()
    expect(screen.getByText("Estate Planning")).toBeInTheDocument()
  })

  it("should render how it works section", () => {
    render(<HomePage />)

    expect(
      screen.getByText("How KeyFate Protects Your Secrets")
    ).toBeInTheDocument()
    expect(screen.getByText("Create & Encrypt")).toBeInTheDocument()
    expect(screen.getByText("Secure Storage")).toBeInTheDocument()
    expect(screen.getByText("Automatic Release")).toBeInTheDocument()
  })

  it("should render features section", () => {
    render(<HomePage />)

    expect(screen.getByText("Military-Grade Encryption")).toBeInTheDocument()
    expect(screen.getByText("Flexible Check-ins")).toBeInTheDocument()
    expect(screen.getByText("Trusted Recipients")).toBeInTheDocument()
    expect(screen.getByText("Instant Setup")).toBeInTheDocument()
    expect(screen.getByText("Global Reliability")).toBeInTheDocument()
    expect(screen.getByText("Full Transparency")).toBeInTheDocument()
  })

  it("should render zero-knowledge promise section", () => {
    render(<HomePage />)

    expect(screen.getByText("Zero-Knowledge Promise")).toBeInTheDocument()
    expect(
      screen.getByText(/We mathematically cannot read your secrets/)
    ).toBeInTheDocument()
  })

  it("should render final CTA section", () => {
    render(<HomePage />)

    expect(
      screen.getByText("Ready to Protect Your Digital Legacy?")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Get Started Free/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /View Pricing/i })
    ).toBeInTheDocument()
  })

  it("should have correct page structure", () => {
    const { container } = render(<HomePage />)

    expect(container.querySelector(".min-h-screen")).toBeInTheDocument()
    expect(container.querySelector(".bg-background")).toBeInTheDocument()
  })

  it("should have how-it-works anchor link", () => {
    const { container } = render(<HomePage />)

    const howItWorksSection = container.querySelector("#how-it-works")
    expect(howItWorksSection).toBeInTheDocument()
  })

  it("should render links with correct href attributes", () => {
    render(<HomePage />)

    const signInLinks = screen.getAllByRole("link", {
      name: /Start Protecting Your Secrets/i,
    })
    expect(signInLinks[0]).toHaveAttribute("href", "/auth/signin")

    const pricingLink = screen.getByRole("link", { name: /View Pricing/i })
    expect(pricingLink).toHaveAttribute("href", "/pricing")

    const blogLink = screen.getByRole("link", { name: /Learn more on our blog/i })
    expect(blogLink).toHaveAttribute("href", "/blog")
  })
})
