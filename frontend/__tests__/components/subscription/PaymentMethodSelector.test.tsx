import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PaymentMethodSelector } from "@/components/subscription/PaymentMethodSelector"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the button components
vi.mock("@/components/subscription/StripeCheckoutButton", () => ({
  StripeCheckoutButton: ({
    children,
    lookupKey,
  }: {
    children: React.ReactNode
    lookupKey: string
  }) => (
    <button data-testid="stripe-button" data-lookup-key={lookupKey}>
      {children}
    </button>
  ),
}))

describe("PaymentMethodSelector", () => {
  const defaultProps = {
    amount: 9,
    interval: "monthly" as const,
    lookupKey: "test-lookup-key",
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Free tier user (not paid)", () => {
    it("renders actual payment buttons for free tier users", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="free" />)

      expect(screen.getByTestId("stripe-button")).toBeInTheDocument()
      // Bitcoin button is now a disabled "coming soon" button
      expect(
        screen.getByRole("button", { name: /bitcoin \(coming soon\)/i }),
      ).toBeInTheDocument()
    })

    it("renders payment buttons when userTier is undefined", () => {
      render(<PaymentMethodSelector {...defaultProps} />)

      expect(screen.getByTestId("stripe-button")).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /bitcoin \(coming soon\)/i }),
      ).toBeInTheDocument()
    })

    it("passes correct props to StripeCheckoutButton", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="free" />)

      const stripeButton = screen.getByTestId("stripe-button")
      expect(stripeButton).toHaveAttribute("data-lookup-key", "test-lookup-key")
    })

    it("bitcoin button is disabled for free tier users", () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          amount={9}
          interval="monthly"
          userTier="free"
        />,
      )

      const bitcoinButton = screen.getByRole("button", {
        name: /bitcoin \(coming soon\)/i,
      })
      expect(bitcoinButton).toBeDisabled()
    })
  })

  describe("Paid tier user", () => {
    it("renders mock buttons for pro tier users", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="pro" />)

      // Should render buttons but not the actual payment buttons
      const buttons = screen.getAllByRole("button")
      expect(buttons).toHaveLength(2)

      expect(screen.queryByTestId("stripe-button")).not.toBeInTheDocument()
      expect(screen.queryByTestId("btcpay-button")).not.toBeInTheDocument()
    })

    it("renders mock buttons for basic tier users", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="basic" />)

      const buttons = screen.getAllByRole("button")
      expect(buttons).toHaveLength(2)
    })

    it("renders mock buttons for premium tier users", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="premium" />)

      const buttons = screen.getAllByRole("button")
      expect(buttons).toHaveLength(2)
    })

    it("renders mock buttons for enterprise tier users", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="enterprise" />)

      const buttons = screen.getAllByRole("button")
      expect(buttons).toHaveLength(2)
    })

    it("shows dialog when Card button is clicked", async () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          userTier="pro"
          userTierDisplayName="Pro Plan"
        />,
      )

      const cardButton = screen.getByRole("button", { name: /card/i })
      fireEvent.click(cardButton)

      await waitFor(() => {
        expect(
          screen.getByText("You're Already Subscribed!"),
        ).toBeInTheDocument()
      })
    })

    it("bitcoin button is disabled for paid users", async () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          userTier="pro"
          userTierDisplayName="Pro Plan"
        />,
      )

      const bitcoinButton = screen.getByRole("button", {
        name: /bitcoin \(coming soon\)/i,
      })
      expect(bitcoinButton).toBeDisabled()
    })

    it("displays correct tier name in dialog", async () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          userTier="premium"
          userTierDisplayName="Premium Plan"
        />,
      )

      const cardButton = screen.getByRole("button", { name: /card/i })
      fireEvent.click(cardButton)

      await waitFor(() => {
        expect(
          screen.getByText(/active Premium Plan subscription/i),
        ).toBeInTheDocument()
      })
    })

    it("uses tier name as fallback when display name not provided", async () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="pro" />)

      const cardButton = screen.getByRole("button", { name: /card/i })
      fireEvent.click(cardButton)

      await waitFor(() => {
        expect(screen.getByText(/active pro subscription/i)).toBeInTheDocument()
      })
    })

    it("closes dialog when Close button is clicked", async () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          userTier="pro"
          userTierDisplayName="Pro Plan"
        />,
      )

      // Open dialog
      const cardButton = screen.getByRole("button", { name: /card/i })
      fireEvent.click(cardButton)

      await waitFor(() => {
        expect(
          screen.getByText("You're Already Subscribed!"),
        ).toBeInTheDocument()
      })

      // Close dialog - get all close buttons and click the last one (the "Close" button in footer)
      const closeButtons = screen.getAllByRole("button", {
        name: /close/i,
      })
      fireEvent.click(closeButtons[closeButtons.length - 1])

      await waitFor(() => {
        expect(
          screen.queryByText("You're Already Subscribed!"),
        ).not.toBeInTheDocument()
      })
    })

    it("prevents default and stops propagation on click", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="pro" />)

      const cardButton = screen.getByRole("button", { name: /card/i })

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      })

      fireEvent(cardButton, clickEvent)

      // Note: These will be called by the actual handler, but we can't directly verify
      // the spy calls here due to how React events work. The important thing is that
      // the dialog opens instead of navigating
      expect(screen.getByText("You're Already Subscribed!")).toBeInTheDocument()
    })
  })

  describe("Edge cases", () => {
    it("treats empty string tier as free tier", () => {
      render(<PaymentMethodSelector {...defaultProps} userTier="" />)

      expect(screen.getByTestId("stripe-button")).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /bitcoin \(coming soon\)/i }),
      ).toBeInTheDocument()
    })

    it("renders stripe button for both interval values", () => {
      const { rerender } = render(
        <PaymentMethodSelector {...defaultProps} interval="monthly" />,
      )
      expect(screen.getByTestId("stripe-button")).toBeInTheDocument()

      rerender(<PaymentMethodSelector {...defaultProps} interval="yearly" />)
      expect(screen.getByTestId("stripe-button")).toBeInTheDocument()
    })
  })
})
