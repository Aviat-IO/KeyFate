import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { NewSecretForm } from "@/components/forms/newSecretForm"
import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

// Mock shamirs-secret-sharing
vi.mock("shamirs-secret-sharing", () => ({
  default: {
    split: vi.fn(() => [
      Buffer.from("share1"),
      Buffer.from("share2"),
      Buffer.from("share3"),
    ]),
  },
}))

// Mock localStorage
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  writable: true,
})

describe("NewSecretForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should show validation error for check_in_days on blur when value is less than 2", async () => {
    render(<NewSecretForm isPaid={true} />)

    const checkInDaysInput = screen.getByLabelText(/trigger deadline/i)

    // Enter a value less than 2
    fireEvent.change(checkInDaysInput, { target: { value: "1" } })

    // Trigger blur event
    fireEvent.blur(checkInDaysInput)

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText("Trigger deadline must be at least 2 days.")).toBeInTheDocument()
    })
  })

  it("should show validation error for SSS threshold when it exceeds total shares", async () => {
    render(<NewSecretForm />)

    // Open the advanced settings accordion
    const accordionTrigger = screen.getByText("Secret Sharing Configuration")
    fireEvent.click(accordionTrigger)

    // Wait for the fields to be visible
    await waitFor(() => {
      expect(screen.getByLabelText(/total shares to create/i)).toBeInTheDocument()
    })

    const totalSharesInput = screen.getByLabelText(/total shares to create/i)
    const thresholdInput = screen.getByLabelText(/shares needed for recovery/i)

    // Set total shares to 3
    fireEvent.change(totalSharesInput, { target: { value: "3" } })
    fireEvent.blur(totalSharesInput)

    // Set threshold to 4 (greater than total shares)
    fireEvent.change(thresholdInput, { target: { value: "4" } })
    fireEvent.blur(thresholdInput)

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText("Threshold must be less than or equal to total shares.")).toBeInTheDocument()
    })
  })

  it("should show validation error for required fields on blur", async () => {
    render(<NewSecretForm />)

    const titleInput = screen.getByLabelText(/secret title/i)
    
    // Focus and blur without entering any value
    fireEvent.focus(titleInput)
    fireEvent.blur(titleInput)

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument()
    })
  })

  it("should show form submission errors in a user-friendly manner", async () => {
    // Mock fetch to return an error
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to create secret: Database connection error" }),
    })

    render(<NewSecretForm />)

    // Fill in all required fields
    fireEvent.change(screen.getByLabelText(/secret title/i), { target: { value: "Test Secret" } })
    fireEvent.change(screen.getByLabelText(/secret message/i), { target: { value: "Test message" } })
    fireEvent.change(screen.getByLabelText(/recipient's name/i), { target: { value: "John Doe" } })
    
    // Fill in email since contact_method defaults to "email"
    fireEvent.change(screen.getByLabelText(/recipient's email/i), { target: { value: "test@example.com" } })

    // Submit the form
    const submitButton = screen.getByText(/create secret/i)
    fireEvent.click(submitButton)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText("Error Creating Secret")).toBeInTheDocument()
      expect(screen.getByText("Failed to create secret: Database connection error")).toBeInTheDocument()
    })
  })

  it("should show select dropdown for free users", () => {
    render(<NewSecretForm isPaid={false} />)

    // Should show select dropdown with default value
    const selectTrigger = screen.getByRole("combobox", { name: /trigger deadline/i })
    expect(selectTrigger).toBeInTheDocument()
    
    // Click to open dropdown and check options
    fireEvent.click(selectTrigger)
    
    expect(screen.getByRole("option", { name: "Daily" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Weekly" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Monthly" })).toBeInTheDocument()
    
    // Should show upgrade message
    expect(screen.getByText(/upgrade to set custom intervals/i)).toBeInTheDocument()
  })

  it("should show number input for paid users", () => {
    render(<NewSecretForm isPaid={true} />)

    // Should show number input
    const numberInput = screen.getByPlaceholderText("Enter custom days")
    expect(numberInput).toBeInTheDocument()
    expect(numberInput).toHaveAttribute("type", "number")
    expect(numberInput).toHaveAttribute("min", "2")
    
    // Should show custom message
    expect(screen.getByText(/minimum 2 days/i)).toBeInTheDocument()
  })
}) 
