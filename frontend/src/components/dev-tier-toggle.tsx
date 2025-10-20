"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Crown } from "lucide-react"
import { useEffect, useState } from "react"

interface DevTierToggleProps {
  currentTier?: "free" | "pro"
  onTierChange?: () => void
}

export function DevTierToggle({
  currentTier = "free",
  onTierChange,
}: DevTierToggleProps) {
  const [isToggling, setIsToggling] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Check environment on client side
    const isDevelopment = process.env.NODE_ENV === "development"
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.includes("local"))
    const isStaging =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("staging") ||
        window.location.hostname.includes("vercel.app"))

    const show = isDevelopment || isLocalhost || isStaging
    console.log("[DevTierToggle] Environment check:", {
      isDevelopment,
      isLocalhost,
      isStaging,
      hostname:
        typeof window !== "undefined" ? window.location.hostname : "server",
      shouldShow: show,
    })
    setShouldShow(show)
  }, [])

  if (!shouldShow) {
    return null
  }

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      console.log("[DevTierToggle] Sending toggle request...")
      const response = await fetch("/api/dev/toggle-tier", {
        method: "POST",
      })

      console.log("[DevTierToggle] Response status:", response.status)
      const data = await response.json()
      console.log("[DevTierToggle] Response data:", data)

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to toggle tier")
      }

      toast({
        title: "Tier Changed",
        description: data.message,
        duration: 3000,
      })

      // Trigger refresh by calling callback and reloading
      if (onTierChange) {
        onTierChange()
      }

      // Reload to update tier info everywhere
      window.location.reload()
    } catch (error) {
      console.error("[DevTierToggle] Error:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Failed to toggle tier"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setIsToggling(false)
    }
  }

  const isPro = currentTier === "pro"

  return (
    <Button
      variant={isPro ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={isToggling}
      className="gap-2"
      title={`Currently: ${currentTier.toUpperCase()} - Click to toggle`}
    >
      <Crown className={`h-4 w-4 ${isPro ? "fill-current" : ""}`} />
      <span className="hidden sm:inline">{isPro ? "Pro" : "Free"}</span>
      <span className="text-xs opacity-70">[DEV]</span>
    </Button>
  )
}
