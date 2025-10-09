import { StripeCheckoutButton } from "@/components/subscription/StripeCheckoutButton"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSession } from "next-auth/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

delete (window as any).location
window.location = { href: "" } as any

vi.mock("next-auth/react")
const mockUseSession = vi.mocked(useSession as unknown as () => any)

describe("StripeCheckoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ""
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "test-user-id", email: "test@example.com" } },
      update: vi.fn(),
    })
  })

  it("should render button with children text", () => {
    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe to Pro
      </StripeCheckoutButton>,
    )
    expect(screen.getByRole("button")).toHaveTextContent("Subscribe to Pro")
  })

  it("should redirect to payment link when authenticated user clicks", async () => {
    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe
      </StripeCheckoutButton>,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.location.href).toContain("buy.stripe.com")
    })
  })

  it("should redirect to login when unauthenticated user clicks", async () => {
    mockUseSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
      update: vi.fn(),
    })

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe
      </StripeCheckoutButton>,
    )

    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.location.href).toContain("/auth/signin")
    })
  })

  it("should show loading state while checking auth", () => {
    mockUseSession.mockReturnValue({
      status: "loading",
      data: null,
      update: vi.fn(),
    })

    render(
      <StripeCheckoutButton lookupKey="pro_monthly">
        Subscribe
      </StripeCheckoutButton>,
    )

    expect(screen.getByRole("button")).toHaveTextContent("Loading...")
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
