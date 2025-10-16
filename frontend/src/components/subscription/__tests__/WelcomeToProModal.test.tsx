import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WelcomeToProModal } from "../WelcomeToProModal"

describe("WelcomeToProModal", () => {
  it("should render when open is true", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText("Welcome to Pro!")).toBeInTheDocument()
  })

  it("should not render when open is false", () => {
    render(<WelcomeToProModal open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText("Welcome to Pro!")).not.toBeInTheDocument()
  })

  it("should display all Pro features", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText("Increased Capacity")).toBeInTheDocument()
    expect(screen.getByText("Message Templates")).toBeInTheDocument()
    expect(screen.getByText("Configurable Security")).toBeInTheDocument()
    expect(screen.getByText("Comprehensive Audit Logs")).toBeInTheDocument()
    expect(screen.getByText("Priority Email Support")).toBeInTheDocument()
  })

  it("should display feature descriptions", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByText(
        /More secrets and recipients for comprehensive protection/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Pre-written templates for common scenarios/i),
    ).toBeInTheDocument()
  })

  it("should display support email", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/Email: support/i)).toBeInTheDocument()
  })

  it("should display message template list", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/Bitcoin Wallet Access/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Password Manager Master Password/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Estate Planning Documents/i)).toBeInTheDocument()
  })

  it("should call onOpenChange when Get Started button is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<WelcomeToProModal open={true} onOpenChange={onOpenChange} />)

    const button = screen.getByRole("button", { name: /get started/i })
    await user.click(button)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("should display audit log features", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/Export to CSV\/JSON/i)).toBeInTheDocument()
    expect(screen.getByText(/Stored indefinitely/i)).toBeInTheDocument()
  })

  it("should display threshold configuration features", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByText(/Choose 2-of-3 up to 7 total shares/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Free tier locked to 2-of-3/i)).toBeInTheDocument()
  })

  it("should display sparkles icon in header", () => {
    render(<WelcomeToProModal open={true} onOpenChange={vi.fn()} />)

    const title = screen.getByText("Welcome to Pro!")
    expect(title).toBeInTheDocument()
  })
})
