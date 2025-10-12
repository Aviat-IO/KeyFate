"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ResendButtonProps {
  email: string
  onResend?: () => Promise<void>
  disabled?: boolean
  className?: string
  cooldownSeconds?: number
}

export function ResendButton({
  email,
  onResend,
  disabled = false,
  className,
  cooldownSeconds = 60,
}: ResendButtonProps) {
  const [isResending, setIsResending] = useState(false)
  const [cooldownTime, setCooldownTime] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (cooldownTime > 0) {
      interval = setInterval(() => {
        setCooldownTime((time) => {
          if (time <= 1) {
            return 0
          }
          return time - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [cooldownTime])

  const handleResend = async () => {
    if (!email || cooldownTime > 0 || isResending || disabled) {
      return
    }

    setIsResending(true)

    try {
      if (onResend) {
        await onResend()
      } else {
        // Default resend implementation
        const response = await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        })

        const result = await response.json()

        if (result.success) {
          toast({
            title: "Email sent",
            description:
              "A new verification email has been sent to your email address.",
          })
          setCooldownTime(cooldownSeconds)
        } else {
          throw new Error(result.error || "Failed to resend verification email")
        }
      }
    } catch (error) {
      console.error("Resend error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to resend verification email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResending(false)
    }
  }

  const isButtonDisabled = disabled || isResending || cooldownTime > 0

  return (
    <Button
      onClick={handleResend}
      disabled={isButtonDisabled}
      variant="outline"
      className={`w-full ${className}`}
      data-testid="resend-verification-button"
    >
      {isResending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : cooldownTime > 0 ? (
        <>
          <RotateCcw className="mr-2 h-4 w-4" />
          Resend in {cooldownTime}s
        </>
      ) : (
        <>
          <RotateCcw className="mr-2 h-4 w-4" />
          Resend verification email
        </>
      )}
    </Button>
  )
}
