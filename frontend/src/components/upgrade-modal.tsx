"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import Link from "next/link"

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature?: string
  currentLimit?: string
  proLimit?: string
}

export function UpgradeModal({
  open,
  onOpenChange,
  feature = "this feature",
  currentLimit,
  proLimit,
}: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upgrade to Pro</DialogTitle>
          <DialogDescription>
            Unlock {feature} and get access to premium features
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {currentLimit && proLimit && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground mb-2">Your Limit</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Free Tier</div>
                  <div className="text-sm text-muted-foreground">{currentLimit}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary">Pro Tier</div>
                  <div className="text-sm text-primary">{proLimit}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Free</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">1 secret</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">1 recipient per secret</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">3 check-in intervals</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm text-muted-foreground">No message templates</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-primary p-4 relative">
              <Badge className="absolute -top-3 left-4 bg-primary">Recommended</Badge>
              <div className="flex items-center gap-2 mb-3">
                <Badge>Pro</Badge>
                <span className="text-xl font-bold">$9/mo</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm font-medium">10 secrets</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm font-medium">5 recipients per secret</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm font-medium">Custom intervals (1 day to 3 years)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm font-medium">Message templates</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                or $90/year (save 17%)
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button asChild>
            <Link href="/pricing">Upgrade to Pro</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
