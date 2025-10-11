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
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose()
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-center">Welcome to Pro!</DialogTitle>
          <DialogDescription className="text-center">
            Your account has been successfully upgraded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Your Pro Benefits:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span><strong>10 secrets</strong> — Create up to 10 dead man's switches</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span><strong>5 recipients per secret</strong> — Share with multiple trusted contacts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span><strong>Custom check-in intervals</strong> — Set any interval from 1 day to 3 years</span>
              </li>
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
