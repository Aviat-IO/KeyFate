import { StripeCheckoutButton } from "@/components/subscription/StripeCheckoutButton"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock fetch
global.fetch = vi.fn()
const mockFetch = global.fetch as any

// Mock window.location
delete (window as any).location
window.location = { href: "" } as any

// Mock Supabase client
const mockGetUser = vi.fn()
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

describe("StripeCheckoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ""
    // Default to authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id", email: "test@example.com" } },
      error: null,
    })
  })

  it("should render button with children text after auth check", async () => {
    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Initially shows loading while checking auth
    expect(screen.getByRole("button")).toHaveTextContent("Loading...")
    expect(screen.getByRole("button")).toBeDisabled()

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("Subscribe to Pro")
      expect(screen.getByRole("button")).not.toBeDisabled()
    })
  })

  it("should be disabled when disabled prop is true", async () => {
    render(
      <StripeCheckoutButton lookupKey="pro_monthly" disabled>
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("should call checkout API on button click for authenticated user", async () => {
    mockFetch.mockResolvedValueOnce({
      redirected: true,
      url: "https://checkout.stripe.com/session/cs_123",
    })

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lookup_key: "pro_monthly" }),
      })
    })
  })

  it("should redirect to login for unauthenticated user", async () => {
    // Mock unauthenticated user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    fireEvent.click(button)

    // Should redirect to login with next parameter
    await waitFor(() => {
      expect(window.location.href).toContain("/auth/login")
      expect(window.location.href).toContain("next=")
      expect(window.location.href).toContain("create-checkout-session")
    })
  })

  it("should show loading state during API call", async () => {
    // Create a promise that we can resolve manually
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    mockFetch.mockReturnValueOnce(promise)

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

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
      url: "https://checkout.stripe.com/session/cs_123",
    })

    // Button should return to normal state
    await waitFor(() => {
      expect(button).toHaveTextContent("Subscribe to Pro")
      expect(button).not.toBeDisabled()
    })
  })

  it("should redirect to checkout URL on successful response", async () => {
    mockFetch.mockResolvedValueOnce({
      redirected: true,
      url: "https://checkout.stripe.com/session/cs_123",
    })

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.location.href).toBe(
        "https://checkout.stripe.com/session/cs_123",
      )
    })
  })

  it("should handle non-redirected response gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mockFetch.mockResolvedValueOnce({
      redirected: false,
      status: 400,
      json: () => Promise.resolve({ error: "Bad request" }),
    })

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Checkout failed", { error: "Bad request" })
    })

    consoleSpy.mockRestore()
  })

  it("should handle API errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("Network error")

    mockFetch.mockRejectedValueOnce(error)

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Error:", error)
    })

    // Button should return to normal state after error
    await waitFor(() => {
      expect(button).toHaveTextContent("Subscribe to Pro")
      expect(button).not.toBeDisabled()
    })

    consoleSpy.mockRestore()
  })

  it("should handle different lookup keys", async () => {
    mockFetch.mockResolvedValueOnce({
      redirected: true,
      url: "https://checkout.stripe.com/session/cs_456",
    })

    render(
      <StripeCheckoutButton lookupKey="pro_yearly">
        Subscribe Yearly
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lookup_key: "pro_yearly" }),
      })
    })
  })

  it("should have correct CSS classes applied", async () => {
    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    expect(button).toHaveClass("w-full")
  })

  it("should be accessible", async () => {
    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toHaveTextContent("Loading...")
    })

    const button = screen.getByRole("button")
    expect(button).toBeInTheDocument()
    expect(button).toHaveAccessibleName("Subscribe to Pro")
  })
})
