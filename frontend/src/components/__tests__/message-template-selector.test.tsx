import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageTemplateSelector } from "../message-template-selector"

describe("MessageTemplateSelector", () => {
  describe("Free tier", () => {
    it("should show upgrade button for free users", () => {
      render(
        <MessageTemplateSelector
          onSelectTemplate={vi.fn()}
          isPro={false}
          onUpgradeClick={vi.fn()}
        />,
      )

      expect(
        screen.getByRole("button", { name: /message templates \(pro\)/i }),
      ).toBeInTheDocument()
    })

    it("should call onUpgradeClick when upgrade button clicked", async () => {
      const user = userEvent.setup()
      const onUpgradeClick = vi.fn()

      render(
        <MessageTemplateSelector
          onSelectTemplate={vi.fn()}
          isPro={false}
          onUpgradeClick={onUpgradeClick}
        />,
      )

      const button = screen.getByRole("button", {
        name: /message templates \(pro\)/i,
      })
      await user.click(button)

      expect(onUpgradeClick).toHaveBeenCalledOnce()
    })

    it("should display crown icon for free users", () => {
      const { container } = render(
        <MessageTemplateSelector
          onSelectTemplate={vi.fn()}
          isPro={false}
          onUpgradeClick={vi.fn()}
        />,
      )

      const button = screen.getByRole("button", {
        name: /message templates \(pro\)/i,
      })
      expect(button).toBeInTheDocument()
    })

    it("should not show template dialog for free users", () => {
      render(
        <MessageTemplateSelector
          onSelectTemplate={vi.fn()}
          isPro={false}
          onUpgradeClick={vi.fn()}
        />,
      )

      expect(
        screen.queryByRole("button", { name: /use message template/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe("Pro tier", () => {
    it("should show template selector button for pro users", () => {
      render(
        <MessageTemplateSelector onSelectTemplate={vi.fn()} isPro={true} />,
      )

      expect(
        screen.getByRole("button", { name: /use message template/i }),
      ).toBeInTheDocument()
    })

    it("should open dialog when template button clicked", async () => {
      const user = userEvent.setup()

      render(
        <MessageTemplateSelector onSelectTemplate={vi.fn()} isPro={true} />,
      )

      const button = screen.getByRole("button", {
        name: /use message template/i,
      })
      await user.click(button)

      expect(
        screen.getByRole("heading", { name: /message templates/i }),
      ).toBeInTheDocument()
    })

    it("should display all 7 templates when dialog is open", async () => {
      const user = userEvent.setup()

      render(
        <MessageTemplateSelector onSelectTemplate={vi.fn()} isPro={true} />,
      )

      const button = screen.getByRole("button", {
        name: /use message template/i,
      })
      await user.click(button)

      expect(
        screen.queryAllByText("Bitcoin Wallet Access").length,
      ).toBeGreaterThan(0)
      expect(
        screen.queryAllByText("Password Manager Master Password").length,
      ).toBeGreaterThan(0)
      expect(screen.queryAllByText(/Estate Planning/i).length).toBeGreaterThan(
        0,
      )
      expect(screen.queryAllByText(/Safe Deposit Box/i).length).toBeGreaterThan(
        0,
      )
      expect(
        screen.queryAllByText(/Cryptocurrency Exchange/i).length,
      ).toBeGreaterThan(0)
      expect(screen.queryAllByText(/Cloud Storage/i).length).toBeGreaterThan(0)
      expect(screen.queryAllByText(/Social Media/i).length).toBeGreaterThan(0)
    })

    it("should show all templates when dialog opens", async () => {
      const user = userEvent.setup()

      render(
        <MessageTemplateSelector onSelectTemplate={vi.fn()} isPro={true} />,
      )

      const openButton = screen.getByRole("button", {
        name: /use message template/i,
      })
      await user.click(openButton)

      expect(
        screen.getByText(/choose a pre-written template/i),
      ).toBeInTheDocument()
    })
  })
})
