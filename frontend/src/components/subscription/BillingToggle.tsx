import { Badge } from "@/components/ui/badge"

interface BillingToggleProps {
  billingPeriod: "monthly" | "yearly"
  onPeriodChange: (period: "monthly" | "yearly") => void
  className?: string
}

export function BillingToggle({
  billingPeriod,
  onPeriodChange,
  className = "",
}: BillingToggleProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="bg-secondary rounded-lg p-1">
        <button
          onClick={() => onPeriodChange("monthly")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            billingPeriod === "monthly"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => onPeriodChange("yearly")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            billingPeriod === "yearly"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Yearly
          <Badge className="bg-success text-success-foreground ml-2 text-xs">
            Save 17%
          </Badge>
        </button>
      </div>
    </div>
  )
}
