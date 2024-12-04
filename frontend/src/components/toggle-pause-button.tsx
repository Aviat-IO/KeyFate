"use client"

import { Button } from "@/components/ui/button"
import { Secret } from "@/types/secret"
import { Loader2, PauseIcon, PlayIcon } from "lucide-react"
import { useState } from "react"

interface TogglePauseButtonProps {
  secretId: string
  status: Secret["status"]
  onToggleSuccess: (updatedSecret: Secret) => void
}

export function TogglePauseButton({
  secretId,
  status,
  onToggleSuccess,
}: TogglePauseButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleTogglePause = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/secrets/${secretId}/toggle-pause`, {
        method: "POST",
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      onToggleSuccess(data.secret)
    } catch (error) {
      console.error("Error toggling pause:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleTogglePause}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {status === "active" ? "Pause" : "Resume"}
        </>
      ) : (
        <>
          {status === "active" ? (
            <>
              <PauseIcon className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4" />
              Resume
            </>
          )}
        </>
      )}
    </Button>
  )
}
