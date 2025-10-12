import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThresholdSelector } from "../ThresholdSelector"
import { useForm, FormProvider } from "react-hook-form"

function TestWrapper({
  isPro,
  onUpgradeClick,
}: {
  isPro: boolean
  onUpgradeClick?: () => void
}) {
  const methods = useForm({
    defaultValues: {
      sss_shares_total: 3,
      sss_threshold: 2,
    },
  })

  return (
    <FormProvider {...methods}>
      <ThresholdSelector
        control={methods.control}
        isPro={isPro}
        isSubmitting={false}
        onUpgradeClick={onUpgradeClick}
      />
    </FormProvider>
  )
}

describe("ThresholdSelector", () => {
  describe("Free tier", () => {
    it("should show fixed 2-of-3 message for free users", () => {
      render(<TestWrapper isPro={false} />)

      expect(
        screen.getByText(/2-of-3 shares \(standard\)/i),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/upgrade to Pro for configurable threshold schemes/i),
      ).toBeInTheDocument()
    })

    it("should not show input fields for free users", () => {
      render(<TestWrapper isPro={false} />)

      expect(
        screen.queryByLabelText(/total shares to create/i),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByLabelText(/shares needed for recovery/i),
      ).not.toBeInTheDocument()
    })

    it("should show upgrade button for free users", () => {
      const onUpgradeClick = vi.fn()
      render(<TestWrapper isPro={false} onUpgradeClick={onUpgradeClick} />)

      const upgradeButton = screen.getByRole("button", { name: /upgrade/i })
      expect(upgradeButton).toBeInTheDocument()
    })

    it("should call onUpgradeClick when upgrade button is clicked", async () => {
      const user = userEvent.setup()
      const onUpgradeClick = vi.fn()

      render(<TestWrapper isPro={false} onUpgradeClick={onUpgradeClick} />)

      const upgradeButton = screen.getByRole("button", { name: /upgrade/i })
      await user.click(upgradeButton)

      expect(onUpgradeClick).toHaveBeenCalledOnce()
    })
  })

  describe("Pro tier", () => {
    it("should show pro feature message", () => {
      render(<TestWrapper isPro={true} />)

      expect(screen.getByText(/pro feature/i)).toBeInTheDocument()
      expect(
        screen.getByText(/configure your security threshold/i),
      ).toBeInTheDocument()
    })

    it("should show input fields for pro users", () => {
      render(<TestWrapper isPro={true} />)

      expect(
        screen.getByLabelText(/total shares to create/i),
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText(/shares needed for recovery \(threshold\)/i),
      ).toBeInTheDocument()
    })

    it("should display max shares as 7 for pro users", () => {
      render(<TestWrapper isPro={true} />)

      const totalSharesInput = screen.getByLabelText(/total shares to create/i)
      expect(totalSharesInput).toHaveAttribute("max", "7")
    })

    it("should display min shares as 3 for total shares", () => {
      render(<TestWrapper isPro={true} />)

      const totalSharesInput = screen.getByLabelText(/total shares to create/i)
      expect(totalSharesInput).toHaveAttribute("min", "3")
    })

    it("should display threshold min as 2", () => {
      render(<TestWrapper isPro={true} />)

      const thresholdInput = screen.getByLabelText(
        /shares needed for recovery \(threshold\)/i,
      )
      expect(thresholdInput).toHaveAttribute("min", "2")
    })

    it("should display threshold max as 7", () => {
      render(<TestWrapper isPro={true} />)

      const thresholdInput = screen.getByLabelText(
        /shares needed for recovery \(threshold\)/i,
      )
      expect(thresholdInput).toHaveAttribute("max", "7")
    })

    it("should mention 3-7 shares range in description", () => {
      render(<TestWrapper isPro={true} />)

      expect(screen.getByText(/3-7/)).toBeInTheDocument()
    })
  })
})
