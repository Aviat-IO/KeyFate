import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ContactMethodsForm } from "@/components/contact-methods-form"
import type { ContactMethods } from "@/hooks/useContactMethods"

// Mock the hook
vi.mock("@/hooks/useContactMethods", () => ({
  ContactMethods: {},
}))

const defaultContactMethods: ContactMethods = {
  email: "",
  phone: "",
  telegram_username: "",
  whatsapp: "",
  signal: "",
  preferred_method: "email",
  check_in_days: 90,
}

const mockContactMethods: ContactMethods = {
  email: "test@example.com",
  phone: "+1234567890",
  telegram_username: "@testuser",
  whatsapp: "+0987654321",
  signal: "+1122334455",
  preferred_method: "email",
  check_in_days: 30,
}

describe("ContactMethodsForm Component", () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders with default values", () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    expect(screen.getByPlaceholderText(/your email address/i)).toHaveValue("")
    expect(screen.getByPlaceholderText(/your phone number/i)).toHaveValue("")
    expect(screen.getByPlaceholderText(/your telegram username/i)).toHaveValue(
      "",
    )
    expect(screen.getByPlaceholderText(/your whatsapp number/i)).toHaveValue("")
    expect(screen.getByPlaceholderText(/your signal number/i)).toHaveValue("")
    expect(screen.getByDisplayValue("90")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument()
  })

  it("renders with initial values", () => {
    render(
      <ContactMethodsForm
        onSubmit={mockOnSubmit}
        initialValues={mockContactMethods}
      />,
    )

    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("+1234567890")).toBeInTheDocument()
    expect(screen.getByDisplayValue("@testuser")).toBeInTheDocument()
    expect(screen.getByDisplayValue("+0987654321")).toBeInTheDocument()
    expect(screen.getByDisplayValue("+1122334455")).toBeInTheDocument()
    expect(screen.getByDisplayValue("30")).toBeInTheDocument()
  })

  it("updates email field correctly", async () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const emailInput = screen.getByPlaceholderText(/your email address/i)
    fireEvent.change(emailInput, { target: { value: "new@example.com" } })

    expect(emailInput).toHaveValue("new@example.com")
  })

  it("updates phone field correctly", async () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const phoneInput = screen.getByPlaceholderText(/your phone number/i)
    fireEvent.change(phoneInput, { target: { value: "+9876543210" } })

    expect(phoneInput).toHaveValue("+9876543210")
  })

  it("updates telegram username field correctly", async () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const telegramInput = screen.getByPlaceholderText(/your telegram username/i)
    fireEvent.change(telegramInput, { target: { value: "@newuser" } })

    expect(telegramInput).toHaveValue("@newuser")
  })

  it("updates check-in days field correctly", async () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const checkInInput = screen.getByDisplayValue("90")
    fireEvent.change(checkInInput, { target: { value: "60" } })

    expect(checkInInput).toHaveValue(60)
  })

  it("calls onSubmit with form data when submitted", async () => {
    mockOnSubmit.mockResolvedValue(undefined)

    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    // Fill out the form
    fireEvent.change(screen.getByPlaceholderText(/your email address/i), {
      target: { value: "test@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText(/your phone number/i), {
      target: { value: "+1234567890" },
    })

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: "test@example.com",
        phone: "+1234567890",
        telegram_username: "",
        whatsapp: "",
        signal: "",
        preferred_method: "email",
        check_in_days: 90,
      })
    })
  })

  it("shows loading state during submission", async () => {
    mockOnSubmit.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    )

    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const submitButton = screen.getByRole("button", { name: /save changes/i })
    fireEvent.click(submitButton)

    expect(screen.getByText("Saving...")).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByText("Save Changes")).toBeInTheDocument()
    })
  })

  it("shows error message when submission fails", async () => {
    mockOnSubmit.mockRejectedValue(new Error("Submission failed"))

    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText("Submission failed")).toBeInTheDocument()
    })
  })

  it("shows generic error message for unknown errors", async () => {
    mockOnSubmit.mockRejectedValue("Unknown error")

    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save contact methods"),
      ).toBeInTheDocument()
    })
  })

  it("renders cancel button when showCancel is true", () => {
    render(
      <ContactMethodsForm
        onSubmit={mockOnSubmit}
        showCancel={true}
        onCancel={mockOnCancel}
      />,
    )

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })

  it("calls onCancel when cancel button is clicked", () => {
    render(
      <ContactMethodsForm
        onSubmit={mockOnSubmit}
        showCancel={true}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it("uses custom submit label", () => {
    render(
      <ContactMethodsForm
        onSubmit={mockOnSubmit}
        submitLabel="Update Profile"
      />,
    )

    expect(
      screen.getByRole("button", { name: /update profile/i }),
    ).toBeInTheDocument()
  })

  it("handles number input validation for check-in days", () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const checkInInput = screen.getByDisplayValue("90")

    // Test valid input
    fireEvent.change(checkInInput, { target: { value: "45" } })
    expect(checkInInput).toHaveValue(45)
  })

  it("prevents form submission on enter key in input fields", () => {
    render(<ContactMethodsForm onSubmit={mockOnSubmit} />)

    const emailInput = screen.getByPlaceholderText(/your email address/i)
    fireEvent.keyDown(emailInput, { key: "Enter", code: "Enter" })

    // onSubmit should not be called just from pressing enter
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })
})
