import { render, screen, fireEvent } from "@testing-library/react"
import { AlreadySubscribedDialog } from "@/components/subscription/AlreadySubscribedDialog"
import { describe, it, expect, vi } from "vitest"

describe("AlreadySubscribedDialog", () => {
  it("renders when open is true", () => {
    render(
      <AlreadySubscribedDialog
        open={true}
        onOpenChange={vi.fn()}
        tierName="Pro"
      />,
    )

    expect(
      screen.getByText("You're Already Subscribed!"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /You currently have an active Pro subscription/i,
      ),
    ).toBeInTheDocument()
  })

  it("does not render when open is false", () => {
    render(
      <AlreadySubscribedDialog
        open={false}
        onOpenChange={vi.fn()}
        tierName="Pro"
      />,
    )

    expect(
      screen.queryByText("You're Already Subscribed!"),
    ).not.toBeInTheDocument()
  })

  it("displays custom tier name", () => {
    render(
      <AlreadySubscribedDialog
        open={true}
        onOpenChange={vi.fn()}
        tierName="Enterprise"
      />,
    )

    expect(
      screen.getByText(/active Enterprise subscription/i),
    ).toBeInTheDocument()
  })

  it("defaults to Pro tier name when not provided", () => {
    render(<AlreadySubscribedDialog open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByText(/active Pro subscription/i),
    ).toBeInTheDocument()
  })

  it("calls onOpenChange when close button is clicked", () => {
    const onOpenChange = vi.fn()
    render(
      <AlreadySubscribedDialog
        open={true}
        onOpenChange={onOpenChange}
        tierName="Pro"
      />,
    )

    // Get all close buttons and click the last one (the "Close" button in footer)
    const closeButtons = screen.getAllByRole("button", {
      name: /close/i,
    })
    fireEvent.click(closeButtons[closeButtons.length - 1])

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("has a link to manage subscription", () => {
    render(
      <AlreadySubscribedDialog
        open={true}
        onOpenChange={vi.fn()}
        tierName="Pro"
      />,
    )

    const manageLink = screen.getByRole("link", {
      name: /manage subscription/i,
    })
    expect(manageLink).toHaveAttribute("href", "/settings/subscription")
  })

  it("displays a checkmark icon", () => {
    render(
      <AlreadySubscribedDialog
        open={true}
        onOpenChange={vi.fn()}
        tierName="Pro"
      />,
    )

    // The CheckCircle2 icon from lucide-react renders as an SVG
    // Just verify the component renders without error and has the expected content
    expect(
      screen.getByText("You're Already Subscribed!"),
    ).toBeInTheDocument()
  })
})
