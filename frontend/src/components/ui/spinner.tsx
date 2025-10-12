"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface SpinnerProps {
  className?: string
  size?: number
  color?: "primary" | "secondary" | "muted" | "foreground"
}

export function Spinner({
  className,
  size = 24,
  color = "muted",
}: SpinnerProps) {
  const colorClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
    muted: "text-muted-foreground",
    foreground: "text-foreground",
  }

  return (
    <Loader2
      className={cn("animate-spin", colorClasses[color], className)}
      style={{ width: size, height: size }}
    />
  )
}

// Centered spinner component
export function CenteredSpinner({
  className,
  size = 32,
  text,
}: {
  className?: string
  size?: number
  text?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12",
        className,
      )}
    >
      <Spinner size={size} />
      {text && (
        <p className="text-muted-foreground mt-3 animate-pulse text-sm">
          {text}
        </p>
      )}
    </div>
  )
}
