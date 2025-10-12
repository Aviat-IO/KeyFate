"use client"

import { PRO_FEATURES } from "@/constants/pro-features"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WelcomeToProModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WelcomeToProModal({
  open,
  onOpenChange,
}: WelcomeToProModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crown className="text-primary h-6 w-6" />
            <DialogTitle className="text-2xl">Welcome to Pro!</DialogTitle>
          </div>
          <DialogDescription>
            You now have access to all premium features. Here's what you can do:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {PRO_FEATURES.map((feature) => (
            <div key={feature.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <Check className="text-primary mt-1 h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                  {feature.features && feature.features.length > 0 && (
                    <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                      {feature.features.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-muted-foreground/60">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Get Started</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
