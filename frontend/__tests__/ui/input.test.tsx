import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Input } from "@/components/ui/input"
import React from "react"

describe("Input", () => {
  it("should render input element", () => {
    render(<Input placeholder="Test input" />)

    const input = screen.getByPlaceholderText("Test input")
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe("INPUT")
  })

  it("should apply default classes", () => {
    render(<Input data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveClass("flex")
    expect(input).toHaveClass("h-10")
    expect(input).toHaveClass("w-full")
    expect(input).toHaveClass("rounded-md")
    expect(input).toHaveClass("border")
  })

  it("should merge custom className with default classes", () => {
    render(<Input className="custom-class" data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveClass("custom-class")
    expect(input).toHaveClass("flex") // Default class should still be present
  })

  it("should handle different input types", () => {
    const { rerender } = render(<Input type="text" data-testid="test-input" />)
    expect(screen.getByTestId("test-input")).toHaveAttribute("type", "text")

    rerender(<Input type="email" data-testid="test-input" />)
    expect(screen.getByTestId("test-input")).toHaveAttribute("type", "email")

    rerender(<Input type="password" data-testid="test-input" />)
    expect(screen.getByTestId("test-input")).toHaveAttribute("type", "password")

    rerender(<Input type="number" data-testid="test-input" />)
    expect(screen.getByTestId("test-input")).toHaveAttribute("type", "number")
  })

  it("should handle value and onChange", () => {
    const handleChange = vi.fn()
    render(
      <Input
        value="test value"
        onChange={handleChange}
        data-testid="test-input"
      />,
    )

    const input = screen.getByTestId("test-input") as HTMLInputElement
    expect(input.value).toBe("test value")

    fireEvent.change(input, { target: { value: "new value" } })
    expect(handleChange).toHaveBeenCalled()
  })

  it("should handle placeholder", () => {
    render(<Input placeholder="Enter your name" />)

    const input = screen.getByPlaceholderText("Enter your name")
    expect(input).toHaveAttribute("placeholder", "Enter your name")
  })

  it("should handle disabled state", () => {
    render(<Input disabled data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toBeDisabled()
    expect(input).toHaveClass("disabled:cursor-not-allowed")
    expect(input).toHaveClass("disabled:opacity-50")
  })

  it("should handle required attribute", () => {
    render(<Input required data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toBeRequired()
  })

  it("should handle min and max for number inputs", () => {
    render(<Input type="number" min={0} max={100} data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveAttribute("min", "0")
    expect(input).toHaveAttribute("max", "100")
  })

  it("should forward ref correctly", () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Input ref={ref} data-testid="test-input" />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current).toBe(screen.getByTestId("test-input"))
  })

  it("should handle focus and blur events", () => {
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()

    render(
      <Input
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid="test-input"
      />,
    )

    const input = screen.getByTestId("test-input")

    fireEvent.focus(input)
    expect(handleFocus).toHaveBeenCalled()

    fireEvent.blur(input)
    expect(handleBlur).toHaveBeenCalled()
  })

  it("should handle keyboard events", () => {
    const handleKeyDown = vi.fn()
    const handleKeyUp = vi.fn()

    render(
      <Input
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        data-testid="test-input"
      />,
    )

    const input = screen.getByTestId("test-input")

    fireEvent.keyDown(input, { key: "Enter" })
    expect(handleKeyDown).toHaveBeenCalled()

    fireEvent.keyUp(input, { key: "Enter" })
    expect(handleKeyUp).toHaveBeenCalled()
  })

  it("should handle defaultValue", () => {
    render(<Input defaultValue="default text" data-testid="test-input" />)

    const input = screen.getByTestId("test-input") as HTMLInputElement
    expect(input.value).toBe("default text")
  })

  it("should handle readOnly state", () => {
    render(<Input readOnly value="readonly value" data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveAttribute("readonly")
  })

  it("should handle autoComplete attribute", () => {
    render(<Input autoComplete="email" data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveAttribute("autocomplete", "email")
  })

  it("should handle name attribute", () => {
    render(<Input name="username" data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveAttribute("name", "username")
  })

  it("should handle id attribute", () => {
    render(<Input id="user-input" data-testid="test-input" />)

    const input = screen.getByTestId("test-input")
    expect(input).toHaveAttribute("id", "user-input")
  })

  it("should handle aria attributes", () => {
    render(
      <Input
        aria-label="Username input"
        aria-describedby="username-help"
        data-testid="test-input"
      />,
    )

    const input = screen.getByTestId("test-input")
    expect(input).toHaveAttribute("aria-label", "Username input")
    expect(input).toHaveAttribute("aria-describedby", "username-help")
  })

  it("should have correct displayName", () => {
    expect(Input.displayName).toBe("Input")
  })
})
