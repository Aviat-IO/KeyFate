"use client"

import { CheckInButton } from "@/components/check-in-button"
import { TogglePauseButton } from "@/components/toggle-pause-button"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Database } from "@/lib/database.types"
import { cn } from "@/lib/utils"
import { Secret } from "@/types/secret"
import { Clock, Pencil } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { format } from "timeago.js"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

interface SecretCardProps {
  secret: Secret
}

interface StatusBadge {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
}

function getStatusBadge(
  status: Secret["status"],
  nextCheckIn: string,
  isTriggered: boolean,
): StatusBadge {
  if (isTriggered) {
    return {
      label: "Sent",
      variant: "destructive",
    }
  }

  if (status === "paused") {
    return {
      label: "Paused",
      variant: "outline",
    }
  }

  const now = new Date()
  const checkInDate = new Date(nextCheckIn)
  const daysUntilCheckIn = Math.ceil(
    (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysUntilCheckIn <= 2) {
    return {
      label: "Urgent",
      variant: "destructive",
    }
  }

  if (daysUntilCheckIn <= 5) {
    return {
      label: "Upcoming",
      variant: "default",
    }
  }

  return {
    label: "Checked in",
    variant: "secondary",
  }
}

export function SecretCard({ secret }: SecretCardProps) {
  const [secretState, setSecretState] = useState<Secret>(secret)
  const [statusBadge, setStatusBadge] = useState<StatusBadge>(
    getStatusBadge(secret.status, secret.next_check_in, secret.is_triggered),
  )
  const [showMessage, setShowMessage] = useState(false)
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)

  useEffect(() => {
    setStatusBadge(
      getStatusBadge(
        secretState.status,
        secretState.next_check_in,
        secretState.is_triggered,
      ),
    )
  }, [secretState.status, secretState.next_check_in, secretState.is_triggered])

  const { toast } = useToast()

  const handleCheckInSuccess = (updatedSecret: Secret) => {
    setSecretState(updatedSecret)
    toast({
      title: "Checked in successfully",
      description: `Your check-in for "${secret.title}" has been recorded.`,
      duration: 6000,
    })
  }

  const handleToggleSuccess = (updatedSecret: Secret) => {
    setSecretState(updatedSecret)
    toast({
      title:
        updatedSecret.status === "active" ? "Secret resumed" : "Secret paused",
      description: `"${secret.title}" has been ${
        updatedSecret.status === "active" ? "resumed" : "paused"
      }.`,
      duration: 6000,
    })
  }

  const getContactDetails = () => {
    const details = []
    if (secretState.recipient_email) {
      details.push(`Email: ${secretState.recipient_email}`)
    }
    if (secretState.recipient_phone) {
      details.push(`Phone: ${secretState.recipient_phone}`)
    }
    return details.join("\n")
  }

  // TODO: Likely remove this
  const decryptMessage = async () => {
    try {
      const response = await fetch("/api/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedMessage: secret.message,
          iv: secret.iv,
        }),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      setDecryptedMessage(data.decryptedMessage)
    } catch (error) {
      console.error("Error decrypting message:", error)
      setDecryptedMessage("Error decrypting message")
    }
  }

  useEffect(() => {
    if (showMessage && !decryptedMessage) {
      decryptMessage()
    }
  }, [showMessage])

  const canCheckIn = useMemo(() => {
    if (!secretState.last_check_in) return true
    const lastCheckIn = new Date(secretState.last_check_in)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)
    return lastCheckIn < fifteenMinutesAgo
  }, [secretState.last_check_in])

  return (
    <div
      className={cn(
        "bg-card flex h-full flex-col rounded-lg border p-4 shadow-sm",
        secretState.is_triggered && "border-destructive/50 bg-destructive/5",
        secretState.status === "paused" && "border-muted bg-muted/5",
      )}
    >
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{secretState.title}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-muted-foreground text-sm hover:cursor-help">
                    Recipient: {secretState.recipient_name}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="whitespace-pre-line">{getContactDetails()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </TooltipTrigger>
              {statusBadge.label === "Paused" && (
                <TooltipContent>
                  <p>Will not trigger even if past the due date</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="mb-4 flex-grow" />

      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        <div className="flex items-center">
          <Clock className="mr-1 h-4 w-4" />
          {secretState.is_triggered
            ? `Sent: ${format(secretState.triggered_at!)}`
            : `Next check-in: ${format(secretState.next_check_in)}`}
        </div>
        {!secretState.is_triggered && secretState.last_check_in && (
          <div className="text-muted-foreground text-xs">
            Last check-in: {format(secretState.last_check_in)}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      <div className="flex items-center justify-end gap-2">
        {!secretState.is_triggered ? (
          <>
            {secretState.status === "active" && canCheckIn && (
              <>
                <CheckInButton
                  secretId={secretState.id}
                  onCheckInSuccess={handleCheckInSuccess}
                  variant="ghost"
                />
                <Separator orientation="vertical" className="h-6" />
              </>
            )}
            <TogglePauseButton
              secretId={secretState.id}
              status={secretState.status}
              onToggleSuccess={handleToggleSuccess}
            />
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/secrets/${secretState.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/secrets/${secretState.id}/view`}>View</Link>
          </Button>
        )}
      </div>

      {showMessage && <p>{decryptedMessage}</p>}
    </div>
  )
}
