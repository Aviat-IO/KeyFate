"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { TIER_CONFIGS } from "@/constants/tiers"

export function UpgradeSuccessDialog() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const success = searchParams.get("success")
    if (success === "true") {
      setOpen(true)
    }
  }, [searchParams])

  const handleClose = () => {
    setOpen(false)
    const currentPath = window.location.pathname
    router.replace(currentPath)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-accent mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <CheckCircle2 className="text-accent-foreground h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Welcome to Pro!</DialogTitle>
          <DialogDescription className="text-center">
            Your account has been successfully upgraded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Your Pro Benefits:</h4>
            <ul className="text-muted-foreground space-y-2 text-sm">
              {TIER_CONFIGS.pro?.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="text-accent-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
