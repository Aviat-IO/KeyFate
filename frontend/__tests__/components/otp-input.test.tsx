import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OTPInput } from "@/components/auth/otp-input"

describe("OTPInput Component", () => {
  const mockOnComplete = vi.fn()
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render 8 input fields by default", () => {
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const inputs = screen.getAllByRole("textbox")
    expect(inputs).toHaveLength(8)
  })

  it("should auto-focus on first input", () => {
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const inputs = screen.getAllByRole("textbox")
    expect(inputs[0]).toHaveFocus()
  })

  it("should advance focus on input", async () => {
    const user = userEvent.setup()
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const inputs = screen.getAllByRole("textbox")

    await user.type(inputs[0], "1")
    expect(inputs[1]).toHaveFocus()

    await user.type(inputs[1], "2")
    expect(inputs[2]).toHaveFocus()
  })

  it("should handle backspace navigation", async () => {
    const user = userEvent.setup()
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const inputs = screen.getAllByRole("textbox")

    // Type in first two inputs
    await user.type(inputs[0], "1")
    await user.type(inputs[1], "2")

    // Backspace should clear current and move focus
    await user.keyboard("{Backspace}")
    expect(inputs[1]).toHaveValue("")
  })

  it("should only allow numeric input", async () => {
    const user = userEvent.setup()
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const firstInput = screen.getAllByRole("textbox")[0]

    await user.type(firstInput, "abc123def")

    // Should only have first numeric character
    expect(firstInput).toHaveValue("1")
  })

  it("should call onComplete when all fields are filled", async () => {
    const user = userEvent.setup()
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const inputs = screen.getAllByRole("textbox")

    // Fill all inputs
    for (let i = 0; i < 8; i++) {
      await user.type(inputs[i], (i % 10).toString())
    }

    expect(mockOnComplete).toHaveBeenCalledWith("01234567")
  })

  it("should support paste functionality", async () => {
    const user = userEvent.setup()
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const firstInput = screen.getAllByRole("textbox")[0]

    // Focus and paste
    firstInput.focus()
    await user.paste("12345678")

    expect(mockOnComplete).toHaveBeenCalledWith("12345678")
  })

  it("should handle paste with non-numeric characters", async () => {
    const user = userEvent.setup()
    render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

    const firstInput = screen.getAllByRole("textbox")[0]

    // Focus and paste mixed content
    firstInput.focus()
    await user.paste("1a2b3c4d5e6f7g8h")

    expect(mockOnComplete).toHaveBeenCalledWith("12345678")
  })

  it("should be disabled when disabled prop is true", () => {
    render(
      <OTPInput onComplete={mockOnComplete} onChange={mockOnChange} disabled />,
    )

    const inputs = screen.getAllByRole("textbox")
    inputs.forEach((input) => {
      expect(input).toBeDisabled()
    })
  })
})
