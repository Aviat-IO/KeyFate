"use client"

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
import Link from "next/link"

interface AlreadySubscribedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tierName?: string
}

export function AlreadySubscribedDialog({
  open,
  onOpenChange,
  tierName = "Pro",
}: AlreadySubscribedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            You're Already Subscribed!
          </DialogTitle>
          <DialogDescription className="text-center">
            You currently have an active {tierName} subscription. There's no
            need to subscribe again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-col gap-2 sm:gap-2">
          <Button asChild className="w-full">
            <Link href="/settings/subscription">Manage Subscription</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
