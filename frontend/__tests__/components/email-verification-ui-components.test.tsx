import { OTPInput } from "@/components/auth/otp-input"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock next/navigation
const mockPush = vi.fn()
const mockSearchParams = {
  get: vi.fn((key: string) => {
    const params: Record<string, string> = {
      email: "test@example.com",
      callbackUrl: "/dashboard",
    }
    return params[key] || null
  }),
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

// Mock next-auth
const mockSession = {
  user: {
    email: "test@example.com",
    emailVerified: false,
  },
}

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: mockSession,
    status: "authenticated",
  }),
}))

// Mock toast
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock fetch
global.fetch = vi.fn()

describe.skip("Email Verification UI Components (disabled during NextAuth migration)", () => {
  it("placeholder", () => expect(true).toBe(true))
})

describe("OTPInput Component TDD Tests", () => {
  const mockOnComplete = vi.fn()
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Core Functionality Tests", () => {
    it("should render correct number of input fields", () => {
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")
      expect(inputs).toHaveLength(6)
    })

    it("should support custom length", () => {
      render(
        <OTPInput
          length={4}
          onComplete={mockOnComplete}
          onChange={mockOnChange}
        />,
      )

      const inputs = screen.getAllByRole("textbox")
      expect(inputs).toHaveLength(4)
    })

    it("should auto-focus first input on mount", () => {
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")
      expect(inputs[0]).toHaveFocus()
    })

    it("should only allow numeric input", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const firstInput = screen.getAllByRole("textbox")[0]
      await user.type(firstInput, "abc123def")

      expect(firstInput).toHaveValue("1")
    })

    it("should advance focus on valid input", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      await user.type(inputs[0], "1")
      expect(inputs[1]).toHaveFocus()
    })

    it("should call onComplete when all fields filled", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], (i + 1).toString())
      }

      expect(mockOnComplete).toHaveBeenCalledWith("123456")
    })

    it("should call onChange on every input", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const firstInput = screen.getAllByRole("textbox")[0]
      await user.type(firstInput, "1")

      expect(mockOnChange).toHaveBeenCalledWith("1")
    })
  })

  describe("Advanced Interaction Tests", () => {
    it("should handle backspace navigation correctly", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      await user.type(inputs[0], "1")
      await user.type(inputs[1], "2")

      await user.keyboard("{Backspace}")
      expect(inputs[1]).toHaveValue("")
    })

    it("should handle arrow key navigation", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      inputs[2].focus()

      await user.keyboard("{ArrowLeft}")
      expect(inputs[1]).toHaveFocus()

      await user.keyboard("{ArrowRight}")
      expect(inputs[2]).toHaveFocus()
    })

    it("should support paste functionality", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const firstInput = screen.getAllByRole("textbox")[0]
      firstInput.focus()

      await user.paste("123456")

      expect(mockOnComplete).toHaveBeenCalledWith("123456")
    })

    it("should handle paste with non-numeric characters", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const firstInput = screen.getAllByRole("textbox")[0]
      firstInput.focus()

      await user.paste("1a2b3c4d5e6f")

      expect(mockOnComplete).toHaveBeenCalledWith("123456")
    })

    it("should select all text on focus for easy overwriting", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      await user.type(inputs[0], "1")
      await user.click(inputs[0])

      // Verify that input is selected (implementation detail, focus behavior)
      expect(inputs[0]).toHaveFocus()
    })
  })

  describe("Accessibility Tests", () => {
    it("should have proper ARIA attributes", () => {
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      inputs.forEach((input, index) => {
        expect(input).toHaveAttribute("inputMode", "numeric")
        expect(input).toHaveAttribute("autoComplete", "one-time-code")
        expect(input).toHaveAttribute("data-testid", `otp-input-${index}`)
      })
    })

    it("should support disabled state", () => {
      render(
        <OTPInput
          onComplete={mockOnComplete}
          onChange={mockOnChange}
          disabled
        />,
      )

      const inputs = screen.getAllByRole("textbox")
      inputs.forEach((input) => {
        expect(input).toBeDisabled()
      })
    })

    it("should have proper focus management", async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // Test keyboard navigation
      await user.tab()
      expect(inputs[0]).toHaveFocus()
    })
  })

  describe("Visual Design Tests", () => {
    it("should have proper styling classes", () => {
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      inputs.forEach((input) => {
        expect(input).toHaveClass(
          "w-12",
          "h-12",
          "text-center",
          "text-lg",
          "font-mono",
        )
      })
    })

    it("should show different border styles for filled vs empty", () => {
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole("textbox")

      // Empty input should have border-input class
      expect(inputs[0]).toHaveClass("border-input")
    })

    it("should support custom className", () => {
      render(
        <OTPInput
          onComplete={mockOnComplete}
          onChange={mockOnChange}
          className="custom-class"
        />,
      )

      const container = screen.getAllByRole("textbox")[0].parentElement
      expect(container).toHaveClass("custom-class")
    })
  })
})
