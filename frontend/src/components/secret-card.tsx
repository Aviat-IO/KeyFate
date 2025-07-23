"use client"

import { CheckInButton } from "@/components/check-in-button"
import { TogglePauseButton } from "@/components/toggle-pause-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Secret } from "@/types"
import { Clock, Pencil, User } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "timeago.js"

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
  serverShareDeleted: boolean,
): StatusBadge {
  if (isTriggered) {
    return {
      label: "Sent",
      variant: "destructive",
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
    label: "Active",
    variant: "secondary",
  }
}

export function SecretCard({ secret }: SecretCardProps) {
  const [secretState, setSecretState] = useState<Secret>(secret)
  const serverShareDeleted = !secretState.server_share
  const [statusBadge, setStatusBadge] = useState<StatusBadge>(
    getStatusBadge(
      secret.status,
      secret.next_check_in,
      secret.is_triggered,
      !secret.server_share,
    ),
  )

  useEffect(() => {
    setStatusBadge(
      getStatusBadge(
        secretState.status,
        secretState.next_check_in,
        secretState.is_triggered,
        serverShareDeleted,
      ),
    )
  }, [
    secretState.status,
    secretState.next_check_in,
    secretState.is_triggered,
    serverShareDeleted,
  ])

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
        updatedSecret.status === "active" ? "resumed and a check-in has been applied" : "paused"
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

  const canCheckIn = useMemo(() => {
    if (!secretState.last_check_in) return true
    const lastCheckIn = new Date(secretState.last_check_in)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)
    return lastCheckIn < fifteenMinutesAgo
  }, [secretState.last_check_in])

  const getTimingText = () => {
    if (secretState.is_triggered) {
      return `Sent ${format(secretState.triggered_at!)}`
    }
    if (serverShareDeleted) {
      return "Disabled"
    }
    return `Triggers ${format(secretState.next_check_in)}`
  }

  const getTriggerTimeTooltip = () => {
    if (secretState.is_triggered || serverShareDeleted) {
      return null
    }
    
    const triggerDate = new Date(secretState.next_check_in)
    return triggerDate.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const getLastCheckInText = () => {
    if (
      !secretState.last_check_in ||
      secretState.is_triggered ||
      serverShareDeleted
    ) {
      return null
    }
    return `Last checkin: ${format(secretState.last_check_in)}`
  }

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        secretState.is_triggered && "border-destructive/50 bg-destructive/5",
        secretState.status === "paused" && "border-accent bg-accent/10",
        serverShareDeleted &&
          "border-muted-foreground/30 bg-muted/50 opacity-90",
      )}
    >
      <CardHeader className="pb-3">
        {/* Mobile Layout: Stack everything vertically */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-start justify-between">
            <h3 className="flex-1 truncate pr-2 text-sm font-semibold">
              {secretState.title}
            </h3>
            <Badge variant={statusBadge.variant} className="text-xs">
              {statusBadge.label}
            </Badge>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-muted-foreground flex items-center gap-2 text-xs cursor-help">
                  <User className="h-3 w-3" />
                  <span className="truncate">{secretState.recipient_name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="whitespace-pre-line">{getContactDetails()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-muted-foreground flex items-center gap-2 text-xs cursor-help">
                  <Clock className="h-3 w-3" />
                  <span>{getTimingText()}</span>
                </div>
              </TooltipTrigger>
              {getTriggerTimeTooltip() && (
                <TooltipContent>
                  <p>Will trigger on {getTriggerTimeTooltip()}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {getLastCheckInText() && (
            <div className="text-muted-foreground text-xs">
              {getLastCheckInText()}
            </div>
          )}
        </div>

        {/* Desktop Layout: More spacious with better information hierarchy */}
        <div className="hidden md:block">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex-1">
              <h3 className="mb-3 text-base font-semibold">
                {secretState.title}
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm cursor-help">
                      <User className="h-4 w-4" />
                      <span>Recipient: {secretState.recipient_name}</span>
                    </div>
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
                  <Badge variant={statusBadge.variant}>
                    {statusBadge.label}
                  </Badge>
                </TooltipTrigger>
                {statusBadge.label === "Paused" && (
                  <TooltipContent>
                    <p>Will not trigger even if past the due date</p>
                  </TooltipContent>
                )}
                {statusBadge.label === "Disabled" && (
                  <TooltipContent>
                    <p>Server share deleted - secret is disabled</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex flex-col gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm cursor-help">
                    <Clock className="h-4 w-4" />
                    <span>{getTimingText()}</span>
                  </div>
                </TooltipTrigger>
                {getTriggerTimeTooltip() && (
                  <TooltipContent>
                    <p>Will trigger on {getTriggerTimeTooltip()}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            {getLastCheckInText() && (
              <div className="text-muted-foreground ml-6 text-xs">
                {getLastCheckInText()}
              </div>
            )}

            {serverShareDeleted && (
              <div className="text-muted-foreground ml-6 text-xs">
                Server share deleted
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Separator className="mb-3" />

        {/* Action Buttons - Responsive layout */}
        <div className="flex items-center justify-end gap-2">
          {!secretState.is_triggered ? (
            <>
              {/* Check-in button - only on larger screens or when urgent */}
              {!serverShareDeleted &&
                secretState.status === "active" &&
                canCheckIn && (
                  <>
                    <CheckInButton
                      secretId={secretState.id}
                      onCheckInSuccess={handleCheckInSuccess}
                      variant="ghost"
                    />
                    <Separator orientation="vertical" className="h-4" />
                  </>
                )}

              {/* Pause/Resume button */}
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

              {/* Edit/View button */}
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
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/secrets/${secretState.id}/view`}>
                <span className="text-sm">View</span>
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
