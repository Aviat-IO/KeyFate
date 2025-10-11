"use client"

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Crown, Info } from "lucide-react"
import { Control } from "react-hook-form"
import { getMaxShares } from "@/lib/tier-validation"

interface ThresholdSelectorProps {
  control: Control<any>
  isPro: boolean
  isSubmitting: boolean
  onUpgradeClick?: () => void
}

export function ThresholdSelector({
  control,
  isPro,
  isSubmitting,
  onUpgradeClick,
}: ThresholdSelectorProps) {
  const maxShares = getMaxShares(isPro ? "pro" : "free")

  if (!isPro) {
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-start justify-between gap-2">
              <div>
                <strong>Security Configuration:</strong> 2-of-3 shares (standard)
                <p className="text-muted-foreground mt-1 text-sm">
                  Your secret will be split into 3 shares, requiring any 2 to
                  reconstruct. Upgrade to Pro for configurable threshold schemes up
                  to 7 shares.
                </p>
              </div>
              {onUpgradeClick && (
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="text-primary hover:underline flex items-center gap-1 whitespace-nowrap text-sm"
                >
                  <Crown className="h-3 w-3" />
                  Upgrade
                </button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Pro Feature:</strong> Configure your security threshold
          <p className="text-muted-foreground mt-1 text-sm">
            Choose how many shares to create (3-{maxShares}) and how many are
            required to reconstruct your secret (2 to total shares).
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField
          control={control}
          name="sss_shares_total"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Shares to Create</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="3"
                  max={maxShares}
                  disabled={isSubmitting}
                  {...field}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "") {
                      field.onChange("")
                    } else {
                      const numValue = parseInt(val, 10)
                      if (!isNaN(numValue)) {
                        field.onChange(numValue)
                      } else {
                        field.onChange(val)
                      }
                    }
                  }}
                />
              </FormControl>
              <FormDescription>
                Total shares to split the secret into. Min 3, Max {maxShares}.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="sss_threshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Shares Needed for Recovery (Threshold)
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="2"
                  max={maxShares}
                  disabled={isSubmitting}
                  {...field}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "") {
                      field.onChange("")
                    } else {
                      const numValue = parseInt(val, 10)
                      if (!isNaN(numValue)) {
                        field.onChange(numValue)
                      } else {
                        field.onChange(val)
                      }
                    }
                  }}
                />
              </FormControl>
              <FormDescription>
                Minimum shares to reconstruct. Min 2, Max {maxShares}. Must be
                &lt;= total shares.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
