import FAQPage from "@/app/faq/page"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/faq",
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
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  Lock: () => <span data-testid="icon-lock">Lock</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  Download: () => <span data-testid="icon-download">Download</span>,
  Globe: () => <span data-testid="icon-globe">Globe</span>,
  ChevronDown: () => <span data-testid="icon-chevron">ChevronDown</span>,
}))

describe("FAQPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render the page with navbar and footer", () => {
    render(<FAQPage />)

    expect(screen.getByTestId("navbar")).toBeInTheDocument()
    expect(screen.getByTestId("footer")).toBeInTheDocument()
  })

  it("should have a fixed navbar with glass effect", () => {
    const { container } = render(<FAQPage />)

    const navContainer = container.querySelector("nav")
    expect(navContainer).toBeInTheDocument()
    expect(navContainer).toHaveClass("fixed")
    expect(navContainer).toHaveClass("top-0")
    expect(navContainer).toHaveClass("backdrop-blur-md")
  })

  it("should render page title and description", () => {
    render(<FAQPage />)

    expect(screen.getByText("How can we help?")).toBeInTheDocument()
    expect(
      screen.getByText(/Everything you need to know about KeyFate/)
    ).toBeInTheDocument()
  })

  it("should render FAQ badge", () => {
    render(<FAQPage />)

    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument()
  })

  it("should render data sovereignty callout", () => {
    render(<FAQPage />)

    expect(screen.getByText("Your Secrets, Your Control")).toBeInTheDocument()
    expect(
      screen.getByText(/KeyFate is designed so you're never locked in/)
    ).toBeInTheDocument()
  })

  it("should render all FAQ categories", () => {
    render(<FAQPage />)

    expect(screen.getByText("Security & Privacy")).toBeInTheDocument()
    expect(screen.getByText("Business Continuity")).toBeInTheDocument()
    expect(screen.getByText("How It Works")).toBeInTheDocument()
    expect(screen.getByText("Account & Billing")).toBeInTheDocument()
    expect(screen.getByText("Future Features")).toBeInTheDocument()
  })

  it("should render security questions", () => {
    render(<FAQPage />)

    expect(screen.getByText("Can KeyFate read my secrets?")).toBeInTheDocument()
    expect(
      screen.getByText("How does Shamir's Secret Sharing work?")
    ).toBeInTheDocument()
    expect(
      screen.getByText("What encryption does KeyFate use?")
    ).toBeInTheDocument()
  })

  it("should render business continuity questions", () => {
    render(<FAQPage />)

    expect(
      screen.getByText("What happens if KeyFate goes out of business?")
    ).toBeInTheDocument()
    expect(
      screen.getByText("What if KeyFate's servers go down temporarily?")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Can I export my data and shares?")
    ).toBeInTheDocument()
    expect(screen.getByText("Is KeyFate open source?")).toBeInTheDocument()
  })

  it("should render how it works questions", () => {
    render(<FAQPage />)

    expect(screen.getByText("How do check-ins work?")).toBeInTheDocument()
    expect(
      screen.getByText("What does my recipient receive if I don't check in?")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Can I have multiple secrets and recipients?")
    ).toBeInTheDocument()
  })

  it("should render billing questions", () => {
    render(<FAQPage />)

    expect(
      screen.getByText("What's included in the free tier?")
    ).toBeInTheDocument()
    expect(screen.getByText("What do I get with Pro?")).toBeInTheDocument()
    expect(
      screen.getByText("What happens if I downgrade from Pro to Free?")
    ).toBeInTheDocument()
    expect(screen.getByText("Do you offer refunds?")).toBeInTheDocument()
  })

  it("should render future features questions", () => {
    render(<FAQPage />)

    expect(screen.getByText("What's on your roadmap?")).toBeInTheDocument()
    expect(screen.getByText("What is Nostr integration?")).toBeInTheDocument()
  })

  it("should render contact support section", () => {
    render(<FAQPage />)

    expect(screen.getByText("Still have questions?")).toBeInTheDocument()
    expect(screen.getByText("Contact Support →")).toBeInTheDocument()

    const supportLink = screen.getByRole("link", { name: /Contact Support/i })
    expect(supportLink).toHaveAttribute("href", "mailto:support@keyfate.com")
  })

  it("should have correct page structure", () => {
    const { container } = render(<FAQPage />)

    expect(container.querySelector(".min-h-screen")).toBeInTheDocument()
    expect(container.querySelector(".bg-background")).toBeInTheDocument()
    expect(container.querySelector(".max-w-4xl")).toBeInTheDocument()
  })

  it("should render accordion items for FAQ questions", () => {
    const { container } = render(<FAQPage />)

    const accordionItems = container.querySelectorAll("[data-state]")
    expect(accordionItems.length).toBeGreaterThan(0)
  })
})
