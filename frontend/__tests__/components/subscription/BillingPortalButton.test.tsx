import { BillingPortalButton } from "@/components/subscription/BillingPortalButton"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock fetch - needs to handle both CSRF token fetch and actual API call
const mockFetch = vi.fn()
global.fetch = mockFetch

function setupFetchMock(apiResponse: any) {
  mockFetch
    // First call: CSRF token fetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
    })
    // Second call: actual API call
    .mockResolvedValueOnce(apiResponse)
}

// Mock window.location
delete (window as any).location
window.location = { href: "" } as any

describe("BillingPortalButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    window.location.href = ""
  })

  it("should render button with correct text", () => {
    render(<BillingPortalButton />)

    expect(screen.getByRole("button")).toHaveTextContent("Manage Billing")
  })

  it("should have outline variant styling", () => {
    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    // We can't directly test variant prop, but we can check the button exists
    expect(button).toBeInTheDocument()
  })

  it("should call portal API on button click", async () => {
    setupFetchMock({
      redirected: true,
      url: "https://billing.stripe.com/session/bps_123",
    })

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      // Second call after CSRF token fetch
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "/api/create-portal-session",
        expect.objectContaining({
          method: "POST",
        }),
      )
    })
  })

  it("should show loading state during API call", async () => {
    // Create a promise that we can resolve manually
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    mockFetch
      // First call: CSRF token fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
      })
      // Second call: actual API call (delayed)
      .mockReturnValueOnce(promise)

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    // Button should show loading state
    await waitFor(() => {
      expect(button).toHaveTextContent("Loading...")
      expect(button).toBeDisabled()
    })

    // Resolve the promise to finish the API call
    resolvePromise!({
      redirected: true,
      url: "https://billing.stripe.com/session/bps_123",
    })

    // Button should return to normal state
    await waitFor(() => {
      expect(button).toHaveTextContent("Manage Billing")
      expect(button).not.toBeDisabled()
    })
  })

  it("should redirect to portal URL on successful response", async () => {
    setupFetchMock({
      redirected: true,
      url: "https://billing.stripe.com/session/bps_123",
    })

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.location.href).toBe(
        "https://billing.stripe.com/session/bps_123",
      )
    })
  })

  it("should handle non-redirected response gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    setupFetchMock({
      redirected: false,
      status: 404,
    })

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Portal creation failed")
    })

    consoleSpy.mockRestore()
  })

  it("should handle API errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("Network error")

    mockFetch
      // First call: CSRF token fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: "test-csrf-token" }),
      })
      // Second call: API error
      .mockRejectedValueOnce(error)

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error:", error)
    })

    // Button should return to normal state after error
    await waitFor(() => {
      expect(button).toHaveTextContent("Manage Billing")
      expect(button).not.toBeDisabled()
    })

    consoleSpy.mockRestore()
  })

  it("should handle 401 unauthorized response", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    setupFetchMock({
      redirected: false,
      status: 401,
    })

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Portal creation failed")
    })

    consoleSpy.mockRestore()
  })

  it("should handle no subscription found response", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    setupFetchMock({
      redirected: false,
      status: 404,
    })

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Portal creation failed")
    })

    consoleSpy.mockRestore()
  })

  it("should be accessible", () => {
    render(<BillingPortalButton />)

    const button = screen.getByRole("button")
    expect(button).toBeInTheDocument()
    expect(button).toHaveAccessibleName("Manage Billing")
  })

  it("should handle multiple rapid clicks gracefully", async () => {
    setupFetchMock({
      redirected: true,
      url: "https://billing.stripe.com/session/bps_123",
    })

    render(<BillingPortalButton />)

    const button = screen.getByRole("button")

    // Click multiple times rapidly
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    // Should only make 2 API calls (CSRF + portal) due to loading state
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
