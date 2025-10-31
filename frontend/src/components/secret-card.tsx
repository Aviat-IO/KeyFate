"use client"

import { CheckInButton } from "@/components/check-in-button"
import { TogglePauseButton } from "@/components/toggle-pause-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { formatGranularTime } from "@/lib/time-utils"
import type { Secret } from "@/lib/db/schema"
import type { SecretWithRecipients } from "@/lib/types/secret-types"
import { cn } from "@/lib/utils"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "timeago.js"

interface SecretCardProps {
  secret: SecretWithRecipients
}

interface StatusBadge {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
}

function getStatusBadge(
  status: SecretWithRecipients["status"],
  nextCheckIn: Date | null,
  triggeredAt: Date | null,
  serverShareDeleted: boolean,
): StatusBadge {
  if (triggeredAt || status === "triggered") {
    return {
      label: "Sent",
      variant: "outline",
    }
  }

  if (serverShareDeleted) {
    return {
      label: "Disabled",
      variant: "outline",
    }
  }

  if (status === "paused") {
    return {
      label: "Paused",
      variant: "outline",
    }
  }

  const now = new Date()
  const checkInDate = nextCheckIn ? new Date(nextCheckIn) : new Date()
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
    label: "Active",
    variant: "secondary",
  }
}

export function SecretCard({ secret }: SecretCardProps) {
  const [secretState, setSecretState] = useState<SecretWithRecipients>(secret)
  const serverShareDeleted = !secretState.serverShare
  const [statusBadge, setStatusBadge] = useState<StatusBadge>(
    getStatusBadge(
      secret.status,
      secret.nextCheckIn,
      secret.triggeredAt,
      !secret.serverShare,
    ),
  )

  const isTriggered =
    secretState.triggeredAt !== null || secretState.status === "triggered"

  useEffect(() => {
    setStatusBadge(
      getStatusBadge(
        secretState.status,
        secretState.nextCheckIn,
        secretState.triggeredAt,
        serverShareDeleted,
      ),
    )
  }, [
    secretState.status,
    secretState.nextCheckIn,
    secretState.triggeredAt,
    serverShareDeleted,
  ])

  const { toast } = useToast()

  const handleCheckInSuccess = (updatedSecret: Secret) => {
    // Merge updated fields with existing state to preserve all metadata
    setSecretState((prevState) => ({
      ...prevState,
      ...updatedSecret,
    }))
    toast({
      title: "Checked in successfully",
      description: `Your check-in for "${secret.title}" has been recorded.`,
      duration: 6000,
    })
  }

  const handleToggleSuccess = (updatedSecret: Secret) => {
    // Merge updated fields with existing state to preserve all metadata
    setSecretState((prevState) => ({
      ...prevState,
      ...updatedSecret,
    }))
    toast({
      title:
        updatedSecret.status === "active" ? "Secret resumed" : "Secret paused",
      description: `"${secret.title}" has been ${
        updatedSecret.status === "active"
          ? "resumed and a check-in has been applied"
          : "paused"
      }.`,
      duration: 6000,
    })
  }

  const canCheckIn = useMemo(() => {
    if (!secretState.lastCheckIn) return true
    const lastCheckIn = new Date(secretState.lastCheckIn)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)
    return lastCheckIn < fifteenMinutesAgo
  }, [secretState.lastCheckIn])

  const getTimingText = () => {
    if (isTriggered) {
      return `Sent ${format(secretState.triggeredAt!)}`
    }
    if (serverShareDeleted) {
      return "Disabled"
    }
    if (secretState.status === "paused") {
      return "Paused"
    }
    return `Triggers in ${formatGranularTime(secretState.nextCheckIn || new Date())}`
  }

  const getTriggerTimeTooltip = () => {
    if (isTriggered || serverShareDeleted) {
      return null
    }

    const triggerDate = secretState.nextCheckIn
      ? new Date(secretState.nextCheckIn)
      : new Date()
    return triggerDate.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })
  }

  const getLastCheckInText = () => {
    if (!secretState.lastCheckIn || isTriggered || serverShareDeleted) {
      return null
    }
    return `Last checkin: ${format(secretState.lastCheckIn)}`
  }

  return (
    <Card
      className={cn(
        "flex flex-col transition-all duration-200",
        isTriggered && "border-destructive/50 bg-destructive/5",
        secretState.status === "paused" && "border-accent bg-accent/10",
        serverShareDeleted &&
          "border-muted-foreground/30 bg-muted/50 opacity-90",
        statusBadge.label === "Urgent" && "border-destructive",
      )}
    >
      <CardHeader className="flex-1 pb-4">
        {/* Mobile Layout: Stack everything vertically */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-start justify-between">
            <h3 className="flex-1 truncate pr-2 text-base font-semibold">
              {secretState.title}
            </h3>
            <Badge variant={statusBadge.variant} className="text-xs">
              {statusBadge.label}
            </Badge>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-foreground mb-1.5 text-sm font-medium">
                {secretState.recipients.length}{" "}
                {secretState.recipients.length === 1
                  ? "Recipient"
                  : "Recipients"}
              </div>
              <ul className="text-muted-foreground ml-1 space-y-0.5 text-xs">
                {secretState.recipients.map((recipient) => (
                  <li key={recipient.id}>
                    • {recipient.name}{" "}
                    {recipient.email
                      ? `(${recipient.email})`
                      : recipient.phone
                        ? `(${recipient.phone})`
                        : ""}
                  </li>
                ))}
              </ul>
            </div>

            {!isTriggered && !serverShareDeleted && (
              <div>
                <div className="text-foreground mb-1.5 text-sm font-medium">
                  {getTimingText()}
                </div>
                {secretState.status === "paused" ? (
                  <div className="text-muted-foreground ml-1 text-xs">
                    Will not trigger until resumed
                  </div>
                ) : (
                  <div className="text-muted-foreground ml-1 text-xs">
                    {getTriggerTimeTooltip()}
                  </div>
                )}
              </div>
            )}

            {isTriggered && (
              <div>
                <div className="text-foreground mb-1.5 text-sm font-medium">
                  {getTimingText()}
                </div>
              </div>
            )}

            {serverShareDeleted && (
              <div>
                <div className="text-foreground mb-1.5 text-sm font-medium">
                  Disabled
                </div>
                <div className="text-muted-foreground ml-1 text-xs">
                  Server share deleted
                </div>
              </div>
            )}

            {getLastCheckInText() && (
              <div className="text-muted-foreground ml-1 text-xs">
                {getLastCheckInText()}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout: More spacious with better information hierarchy */}
        <div className="hidden md:block">
          <div className="mb-4 flex items-start justify-between">
            <h3 className="text-xl font-semibold">{secretState.title}</h3>
            <Badge variant={statusBadge.variant} className="text-sm">
              {statusBadge.label}
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-foreground mb-2 text-base font-medium">
                {secretState.recipients.length}{" "}
                {secretState.recipients.length === 1
                  ? "Recipient"
                  : "Recipients"}
              </div>
              <ul className="text-muted-foreground ml-1 space-y-1 text-sm">
                {secretState.recipients.map((recipient) => (
                  <li key={recipient.id}>
                    • {recipient.name}{" "}
                    {recipient.email
                      ? `(${recipient.email})`
                      : recipient.phone
                        ? `(${recipient.phone})`
                        : ""}
                  </li>
                ))}
              </ul>
            </div>

            {!isTriggered && !serverShareDeleted && (
              <div>
                <div className="text-foreground mb-2 text-base font-medium">
                  {getTimingText()}
                </div>
                {secretState.status === "paused" ? (
                  <div className="text-muted-foreground ml-1 text-sm">
                    Will not trigger until resumed
                  </div>
                ) : (
                  <div className="text-muted-foreground ml-1 text-sm">
                    {getTriggerTimeTooltip()}
                  </div>
                )}
              </div>
            )}

            {isTriggered && (
              <div>
                <div className="text-foreground mb-2 text-base font-medium">
                  {getTimingText()}
                </div>
              </div>
            )}

            {serverShareDeleted && (
              <div>
                <div className="text-foreground mb-2 text-base font-medium">
                  Disabled
                </div>
                <div className="text-muted-foreground ml-1 text-sm">
                  Server share deleted
                </div>
              </div>
            )}

            {getLastCheckInText() && (
              <div className="text-muted-foreground ml-1 text-sm">
                {getLastCheckInText()}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Separator className="mb-3" />

        {/* Action Buttons - Responsive layout */}
        <div className="flex items-center justify-between gap-2">
          {!isTriggered ? (
            <>
              {/* Pause/Resume and Edit buttons - left aligned with separator */}
              <div className="flex items-center gap-2">
                {!serverShareDeleted && (
                  <>
                    <TogglePauseButton
                      secretId={secretState.id}
                      status={secretState.status}
                      onToggleSuccess={handleToggleSuccess}
                    />
                    <Separator orientation="vertical" className="h-4" />
                  </>
                )}

                <Button variant="ghost" size="sm" asChild>
                  <Link
                    href={
                      serverShareDeleted
                        ? `/secrets/${secretState.id}/view`
                        : `/secrets/${secretState.id}/edit`
                    }
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">
                      {serverShareDeleted ? "View" : "Edit"}
                    </span>
                  </Link>
                </Button>
              </div>

              {/* Check-in button - right aligned */}
              <div>
                {!serverShareDeleted &&
                  secretState.status === "active" &&
                  canCheckIn && (
                    <CheckInButton
                      secretId={secretState.id}
                      onCheckInSuccess={handleCheckInSuccess}
                      variant="outline"
                    />
                  )}
              </div>
            </>
          ) : (
            <>
              <div />
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/secrets/${secretState.id}/view`}>
                  <span className="text-sm">View</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
