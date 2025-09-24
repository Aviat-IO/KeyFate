"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

interface OTPInputProps {
  length?: number
  onComplete: (otp: string) => void
  onChange: (otp: string) => void
  disabled?: boolean
  className?: string
}

export function OTPInput({
  length = 6,
  onComplete,
  onChange,
  disabled = false,
  className,
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>(
    new Array(length).fill(null),
  )

  useEffect(() => {
    // Auto-focus first input on mount
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (value: string, index: number) => {
    // Only allow numeric input
    const numericValue = value.replace(/\D/g, "")

    if (numericValue.length > 1) {
      // Handle paste - split the value across inputs
      const otpArray = numericValue.slice(0, length).split("")
      const newOtp = [...otp]

      otpArray.forEach((digit, i) => {
        if (index + i < length) {
          newOtp[index + i] = digit
        }
      })

      setOtp(newOtp)
      onChange(newOtp.join(""))

      if (newOtp.join("").length === length) {
        onComplete(newOtp.join(""))
      }

      // Focus the last filled input or the next empty one
      const nextIndex = Math.min(index + otpArray.length, length - 1)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    // Single character input
    const newOtp = [...otp]
    newOtp[index] = numericValue

    setOtp(newOtp)
    onChange(newOtp.join(""))

    // Auto-advance to next input
    if (numericValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Call onComplete when all fields are filled
    if (newOtp.every((digit) => digit !== "") && newOtp.length === length) {
      // Defer to next tick so tests can set mocks after typing
      setTimeout(() => onComplete(newOtp.join("")), 0)
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault()

      const newOtp = [...otp]

      if (newOtp[index]) {
        // Clear current field
        newOtp[index] = ""
      } else if (index > 0) {
        // Move to previous field and clear it
        newOtp[index - 1] = ""
        inputRefs.current[index - 1]?.focus()
      }

      setOtp(newOtp)
      onChange(newOtp.join(""))
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleFocus = (index: number) => {
    // Select all text when focusing for easier overwriting
    inputRefs.current[index]?.select()
  }

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "")

    if (pastedData) {
      handleChange(pastedData, index)
    }
  }

  return (
    <div className={cn("flex justify-center gap-2", className)}>
      {otp.map((digit, index) => (
        <Input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e.target.value, index)}
          // Ensure programmatic clear (set value to empty) is treated as change
          onInput={(e) =>
            handleChange((e.target as HTMLInputElement).value, index)
          }
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => handleFocus(index)}
          onClick={() => handleFocus(index)}
          onPaste={(e) => handlePaste(e, index)}
          disabled={disabled}
          className={cn(
            "h-12 w-12 text-center font-mono text-lg",
            "rounded-md border-2",
            "focus:border-primary focus:ring-primary/20 focus:ring-2",
            digit ? "border-primary" : "border-input",
          )}
          autoComplete="one-time-code"
          data-testid={`otp-input-${index}`}
        />
      ))}
    </div>
  )
}
