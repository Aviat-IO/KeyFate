import { Footer } from "@/components/footer"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/contexts/ConfigContext", () => ({
  useConfig: () => ({
    config: {
      company: "KeyFate",
      parentCompany: "Aviat, LLC",
    },
  }),
}))

vi.mock("next/image", () => ({
  default: ({ alt, className }: { alt: string; className: string }) => (
    <img alt={alt} className={className} data-testid="footer-logo" />
  ),
}))

vi.mock("@/lib/env", () => ({
  NEXT_PUBLIC_SUPPORT_EMAIL: "support@keyfate.com",
}))

describe("Footer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render company logo and name", () => {
    render(<Footer />)

    const logos = screen.getAllByTestId("footer-logo")
    expect(logos.length).toBe(2) // Light and dark mode logos

    expect(screen.getByText("KeyFate")).toBeInTheDocument()
  })

  it("should render tagline", () => {
    render(<Footer />)

    expect(
      screen.getByText("Zero-knowledge security. Open source.")
    ).toBeInTheDocument()
  })

  it("should render navigation links", () => {
    render(<Footer />)

    expect(screen.getByRole("link", { name: "FAQ" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Blog" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Privacy" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Terms" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument()
  })

  it("should have correct href for FAQ link", () => {
    render(<Footer />)

    const faqLink = screen.getByRole("link", { name: "FAQ" })
    expect(faqLink).toHaveAttribute("href", "/faq")
  })

  it("should have correct href for Pricing link", () => {
    render(<Footer />)

    const pricingLink = screen.getByRole("link", { name: "Pricing" })
    expect(pricingLink).toHaveAttribute("href", "/pricing")
  })

  it("should have correct href for Blog link", () => {
    render(<Footer />)

    const blogLink = screen.getByRole("link", { name: "Blog" })
    expect(blogLink).toHaveAttribute("href", "/blog")
  })

  it("should have correct href for Privacy link", () => {
    render(<Footer />)

    const privacyLink = screen.getByRole("link", { name: "Privacy" })
    expect(privacyLink).toHaveAttribute("href", "/privacy-policy")
  })

  it("should have correct href for Terms link", () => {
    render(<Footer />)

    const termsLink = screen.getByRole("link", { name: "Terms" })
    expect(termsLink).toHaveAttribute("href", "/terms-of-service")
  })

  it("should have external GitHub link with correct attributes", () => {
    render(<Footer />)

    const githubLink = screen.getByRole("link", { name: "GitHub" })
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/Aviat-IO/keyfate"
    )
    expect(githubLink).toHaveAttribute("target", "_blank")
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("should have contact email link", () => {
    render(<Footer />)

    const contactLink = screen.getByRole("link", { name: "Contact" })
    expect(contactLink).toHaveAttribute("href", "mailto:support@keyfate.com")
  })

  it("should have correct footer structure", () => {
    const { container } = render(<Footer />)

    const footer = container.querySelector("footer")
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass("border-t")
    expect(footer).toHaveClass("border-border/50")
  })

  it("should have responsive layout classes", () => {
    const { container } = render(<Footer />)

    const wrapper = container.querySelector(".max-w-6xl")
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass("flex")
    expect(wrapper).toHaveClass("flex-col")
    expect(wrapper).toHaveClass("md:flex-row")
  })

  it("should render links with hover transition", () => {
    render(<Footer />)

    const faqLink = screen.getByRole("link", { name: "FAQ" })
    expect(faqLink).toHaveClass("transition-colors")
    expect(faqLink).toHaveClass("hover:text-foreground")
  })
})
