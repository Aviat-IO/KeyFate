import { EditSecretForm } from "@/components/forms/editSecretForm"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

// Mock DeleteConfirm component
vi.mock("@/components/delete-confirm", () => ({
  DeleteConfirm: ({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    loading,
  }: any) => (
    <div data-testid="delete-confirm" data-open={open}>
      {open && (
        <div>
          <div data-testid="delete-title">{title}</div>
          <div data-testid="delete-description">{description}</div>
          <button
            onClick={onConfirm}
            disabled={loading}
            data-testid="delete-confirm-button"
          >
            {loading ? "Deleting..." : "Delete Secret"}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            data-testid="delete-cancel-button"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  ),
}))

describe("EditSecretForm", () => {
  const mockInitialData = {
    title: "Test Secret",
    recipients: [
      {
        name: "John Doe",
        email: "test@example.com",
        phone: "",
        isPrimary: true,
      },
    ],
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
      />,
    )

    // Should show select dropdown with current value
    const selectTrigger = screen.getByRole("combobox", {
      name: /trigger deadline/i,
    })
    expect(selectTrigger).toBeInTheDocument()

    // Click to open dropdown and check options
    fireEvent.click(selectTrigger)

    expect(screen.getByRole("option", { name: "Daily" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Weekly" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Monthly" })).toBeInTheDocument()

    // Should show upgrade message
    expect(
      screen.getByText(/upgrade to set custom intervals/i),
    ).toBeInTheDocument()
  })

  it("should show number input for paid users", () => {
    render(
      <EditSecretForm
        initialData={mockInitialData}
        secretId="test-id"
        isPaid={true}
      />,
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
      />,
    )

    // Change the trigger deadline using select
    const selectTrigger = screen.getByRole("combobox", {
      name: /trigger deadline/i,
    })
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
      />,
    )

    // Change the trigger deadline using number input
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
      />,
    )

    // Enter invalid value
    const numberInput = screen.getByDisplayValue("90")
    fireEvent.change(numberInput, { target: { value: "1" } })
    fireEvent.blur(numberInput)

    // Wait for validation error
    await waitFor(() => {
      expect(
        screen.getByText("Trigger deadline must be at least 2 days."),
      ).toBeInTheDocument()
    })
  })

  it("should render delete button with destructive styling", () => {
    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    const deleteButton = screen.getByText("Delete Secret")
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).toHaveClass("bg-destructive")
  })

  it("should show delete confirmation modal when delete button is clicked", () => {
    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    // Modal should be open
    const modal = screen.getByTestId("delete-confirm")
    expect(modal).toHaveAttribute("data-open", "true")
    expect(screen.getByTestId("delete-title")).toHaveTextContent(
      "Delete Secret",
    )
    expect(screen.getByTestId("delete-description")).toHaveTextContent(
      "Are you sure you want to delete this secret? This action cannot be undone and the secret will be permanently removed.",
    )
  })

  it("should close delete modal when cancel is clicked", () => {
    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    // Open modal
    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    // Click cancel
    const cancelButton = screen.getByTestId("delete-cancel-button")
    fireEvent.click(cancelButton)

    // Modal should be closed
    const modal = screen.getByTestId("delete-confirm")
    expect(modal).toHaveAttribute("data-open", "false")
  })

  it("should handle successful delete", async () => {
    // Mock successful delete response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    // Open modal and confirm delete
    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByTestId("delete-confirm-button")
    fireEvent.click(confirmButton)

    // Should call DELETE API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/secrets/test-id", {
        method: "DELETE",
      })
    })
  })

  it("should handle delete error", async () => {
    // Mock delete error response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to delete secret" }),
    })

    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    // Open modal and confirm delete
    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByTestId("delete-confirm-button")
    fireEvent.click(confirmButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText("Failed to delete secret")).toBeInTheDocument()
    })

    // Modal should be closed
    const modal = screen.getByTestId("delete-confirm")
    expect(modal).toHaveAttribute("data-open", "false")
  })

  it("should show loading state during delete", async () => {
    // Mock slow delete response
    ;(global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ success: true }),
              }),
            100,
          ),
        ),
    )

    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    // Open modal and confirm delete
    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByTestId("delete-confirm-button")
    fireEvent.click(confirmButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText("Deleting...")).toBeInTheDocument()
    })
  })

  it("should disable all buttons during delete operation", async () => {
    // Mock slow delete response - make it slower to catch the disabled state
    ;(global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ success: true }),
              }),
            1000, // Increased from 100ms to 1000ms
          ),
        ),
    )

    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    // Open modal and confirm delete
    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByTestId("delete-confirm-button")
    fireEvent.click(confirmButton)

    // Wait a tiny bit for the state to update, then check buttons are disabled
    await waitFor(
      () => {
        // Get the form's cancel button specifically (not the modal's)
        const formCancelButton = screen.getByTestId("form-cancel-button")
        expect(formCancelButton).toBeDisabled()
        expect(screen.getByText("Save Changes")).toBeDisabled()
        expect(deleteButton).toBeDisabled()
      },
      { timeout: 10000 },
    )
  })

  it("should handle network error during delete", async () => {
    // Mock network error
    ;(global.fetch as any).mockRejectedValueOnce(new Error("Network error"))

    render(<EditSecretForm initialData={mockInitialData} secretId="test-id" />)

    // Open modal and confirm delete
    const deleteButton = screen.getByText("Delete Secret")
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByTestId("delete-confirm-button")
    fireEvent.click(confirmButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })
})
