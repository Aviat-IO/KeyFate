import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "@/components/ui/button"

describe("Button Component", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>)

    const button = screen.getByRole("button", { name: "Click me" })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass("inline-flex", "items-center", "justify-center")
  })

  it("renders different variants correctly", () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>)

    let button = screen.getByRole("button")
    expect(button).toHaveClass("bg-destructive", "text-destructive-foreground")

    rerender(<Button variant="outline">Outline</Button>)
    button = screen.getByRole("button")
    expect(button).toHaveClass("border", "border-input", "bg-background")

    rerender(<Button variant="ghost">Ghost</Button>)
    button = screen.getByRole("button")
    expect(button).toHaveClass("hover:bg-accent")
  })

  it("renders different sizes correctly", () => {
    const { rerender } = render(<Button size="sm">Small</Button>)

    let button = screen.getByRole("button")
    expect(button).toHaveClass("h-9", "px-3")

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole("button")
    expect(button).toHaveClass("h-11", "px-8")

    rerender(<Button size="icon">Icon</Button>)
    button = screen.getByRole("button")
    expect(button).toHaveClass("h-10", "w-10")
  })

  it("handles click events", () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>)

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveClass(
      "disabled:pointer-events-none",
      "disabled:opacity-50",
    )
  })

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>)

    const button = screen.getByRole("button")
    expect(button).toHaveClass("custom-class")
  })

  it("forwards ref correctly", () => {
    const ref = vi.fn()
    render(<Button ref={ref}>Ref test</Button>)

    expect(ref).toHaveBeenCalled()
  })

  it("renders as child component when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    )

    const link = screen.getByRole("link")
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/test")
    expect(link).toHaveClass("inline-flex", "items-center")
  })

  it("supports all HTML button attributes", () => {
    render(
      <Button
        type="submit"
        form="test-form"
        aria-label="Submit form"
        data-testid="submit-button"
      >
        Submit
      </Button>,
    )

    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("type", "submit")
    expect(button).toHaveAttribute("form", "test-form")
    expect(button).toHaveAttribute("aria-label", "Submit form")
    expect(button).toHaveAttribute("data-testid", "submit-button")
  })

  it("combines variant and size classes correctly", () => {
    render(
      <Button variant="outline" size="lg">
        Large Outline
      </Button>,
    )

    const button = screen.getByRole("button")
    expect(button).toHaveClass("border", "border-input") // outline variant
    expect(button).toHaveClass("h-11", "px-8") // lg size
  })
})
