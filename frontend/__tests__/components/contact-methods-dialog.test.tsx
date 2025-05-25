import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { ContactMethodsDialog } from "@/components/contact-methods-dialog"
import type { ContactMethods } from "@/hooks/useContactMethods"

// Mock contact methods data
const mockContactMethods: ContactMethods = {
  email: "test@example.com",
  phone: "+1234567890",
  telegram_username: "",
  whatsapp: "",
  signal: "",
  preferred_method: "email",
  check_in_days: 90,
}

// Mock the ContactMethodsForm component
vi.mock("@/components/contact-methods-form", () => ({
  ContactMethodsForm: ({
    onSubmit,
    submitLabel,
  }: {
    onSubmit: (methods: ContactMethods) => Promise<void>
    submitLabel: string
  }) => (
    <div data-testid="contact-methods-form">
      <button
        onClick={() => {
          // Handle the promise to avoid unhandled rejections
          onSubmit(mockContactMethods).catch(() => {
            // Silently catch errors in tests - the parent component handles them
          })
        }}
        data-testid="form-submit"
      >
        {submitLabel}
      </button>
    </div>
  ),
}))

// Mock the Dialog components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => (
    <div data-testid="dialog" data-open={open}>
      {open && (
        <div>
          <button
            onClick={() => onOpenChange(false)}
            data-testid="dialog-close"
          >
            Close
          </button>
          {children}
        </div>
      )}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}))

describe("ContactMethodsDialog", () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSubmit = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onSubmit: mockOnSubmit,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render dialog when open", () => {
    render(<ContactMethodsDialog {...defaultProps} />)

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true")
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument()
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument()
  })

  it("should not render dialog content when closed", () => {
    render(<ContactMethodsDialog {...defaultProps} open={false} />)

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false")
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument()
  })

  it("should render correct dialog title and description", () => {
    render(<ContactMethodsDialog {...defaultProps} />)

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Set Up Contact Methods",
    )
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "Please provide at least one way for us to contact you for check-ins. This information will be saved for future use.",
    )
  })

  it("should render ContactMethodsForm with correct props", () => {
    render(<ContactMethodsDialog {...defaultProps} />)

    expect(screen.getByTestId("contact-methods-form")).toBeInTheDocument()
    expect(screen.getByTestId("form-submit")).toHaveTextContent("Continue")
  })

  it("should call onOpenChange when dialog close is triggered", () => {
    render(<ContactMethodsDialog {...defaultProps} />)

    const closeButton = screen.getByTestId("dialog-close")
    fireEvent.click(closeButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it("should handle form submission correctly", async () => {
    mockOnSubmit.mockResolvedValue(undefined)

    render(<ContactMethodsDialog {...defaultProps} />)

    const submitButton = screen.getByTestId("form-submit")
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(mockContactMethods)
    })

    // Should close dialog after successful submission
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it("should handle form submission error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockOnSubmit.mockRejectedValue(new Error("Submission failed"))

    render(<ContactMethodsDialog {...defaultProps} />)

    const submitButton = screen.getByTestId("form-submit")
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })

    // The dialog should not close on error - the component handles this gracefully
    // by letting the parent component handle the error
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)

    consoleSpy.mockRestore()
  })

  it("should pass onOpenChange to Dialog component", () => {
    render(<ContactMethodsDialog {...defaultProps} />)

    // Verify that the Dialog component receives the onOpenChange prop
    const dialog = screen.getByTestId("dialog")
    expect(dialog).toBeInTheDocument()

    // Test that onOpenChange is called when dialog state changes
    const closeButton = screen.getByTestId("dialog-close")
    fireEvent.click(closeButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it("should handle multiple rapid submissions", async () => {
    mockOnSubmit.mockResolvedValue(undefined)

    render(<ContactMethodsDialog {...defaultProps} />)

    const submitButton = screen.getByTestId("form-submit")

    // Click multiple times rapidly
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })

    // Should handle multiple submissions gracefully
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it("should maintain dialog state correctly", () => {
    const { rerender } = render(
      <ContactMethodsDialog {...defaultProps} open={false} />,
    )

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false")

    rerender(<ContactMethodsDialog {...defaultProps} open={true} />)

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true")
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument()
  })
})
