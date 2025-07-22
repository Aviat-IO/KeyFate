"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingIndicatorProps {
  className?: string
  text?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingIndicator({
  className,
  text = "Loading your secrets...",
  size = "md",
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <div className="relative">
        <Loader2 className={cn(
          sizeClasses[size],
          "animate-spin text-muted-foreground/60"
        )} />
        <div className="absolute inset-0 animate-pulse">
          <Loader2 className={cn(
            sizeClasses[size],
            "animate-spin text-primary/20"
          )} />
        </div>
      </div>
      {text && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}

// Simple version for minimal use cases
export function SimpleLoadingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}