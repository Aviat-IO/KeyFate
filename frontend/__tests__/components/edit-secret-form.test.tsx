import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { EditSecretForm } from "@/components/forms/editSecretForm"
import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

describe("EditSecretForm", () => {
  const mockInitialData = {
    title: "Test Secret",
    recipient_name: "John Doe",
    recipient_email: "test@example.com",
    recipient_phone: "",
    contact_method: "email" as const,
    check_in_days: 90,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should show select dropdown for free users", () => {
    render(
      <EditSecretForm 
        initialData={mockInitialData} 
        secretId="test-id" 
        isPaid={false} 
      />
    )

    // Should show select dropdown with current value
    const selectTrigger = screen.getByRole("combobox", { name: /check-in frequency/i })
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
    render(
      <EditSecretForm 
        initialData={mockInitialData} 
        secretId="test-id" 
        isPaid={true} 
      />
    )

    // Should show number input with current value
    const numberInput = screen.getByDisplayValue("90")
    expect(numberInput).toBeInTheDocument()
    expect(numberInput).toHaveAttribute("type", "number")
    expect(numberInput).toHaveAttribute("min", "2")
    expect(numberInput).toHaveAttribute("max", "365")
    
    // Should show custom message
    expect(screen.getByText(/minimum 2 days/i)).toBeInTheDocument()
  })

  it("should handle form submission for free users", async () => {
    // Mock successful response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(
      <EditSecretForm 
        initialData={mockInitialData} 
        secretId="test-id" 
        isPaid={false} 
      />
    )

    // Change the check-in frequency using select
    const selectTrigger = screen.getByRole("combobox", { name: /check-in frequency/i })
    fireEvent.click(selectTrigger)
    
    // Select weekly
    const weeklyOption = screen.getByRole("option", { name: "Weekly" })
    fireEvent.click(weeklyOption)

    // Submit the form
    const submitButton = screen.getByText("Save Changes")
    fireEvent.click(submitButton)

    // Wait for submission
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/secrets/test-id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mockInitialData,
          check_in_days: 7, // Weekly
        }),
      })
    })
  })

  it("should handle form submission for paid users", async () => {
    // Mock successful response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(
      <EditSecretForm 
        initialData={mockInitialData} 
        secretId="test-id" 
        isPaid={true} 
      />
    )

    // Change the check-in frequency using number input
    const numberInput = screen.getByDisplayValue("90")
    fireEvent.change(numberInput, { target: { value: "45" } })

    // Submit the form
    const submitButton = screen.getByText("Save Changes")
    fireEvent.click(submitButton)

    // Wait for submission
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/secrets/test-id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mockInitialData,
          check_in_days: 45,
        }),
      })
    })
  })

  it("should show validation error for invalid check-in days", async () => {
    render(
      <EditSecretForm 
        initialData={mockInitialData} 
        secretId="test-id" 
        isPaid={true} 
      />
    )

    // Enter invalid value
    const numberInput = screen.getByDisplayValue("90")
    fireEvent.change(numberInput, { target: { value: "1" } })
    fireEvent.blur(numberInput)

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText("Check-in frequency must be at least 2 days.")).toBeInTheDocument()
    })
  })
}) 
