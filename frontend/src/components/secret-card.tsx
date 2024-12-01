"use client"

import { CheckInButton } from "@/components/check-in-button"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Database } from "@/lib/database.types"
import { cn } from "@/lib/utils"
import { Secret } from "@/types/secret"
import { Clock } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { format } from "timeago.js"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SecretCardProps {
  secret: Secret
}

interface StatusBadge {
  label: string
  className: string
}

function getStatusBadge(nextCheckIn: string): StatusBadge {
  const now = new Date()
  const checkInDate = new Date(nextCheckIn)
  const daysUntilCheckIn = Math.ceil(
    (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysUntilCheckIn <= 2) {
    return {
      label: "Urgent",
      className: "bg-destructive text-destructive-foreground",
    }
  }

  if (daysUntilCheckIn <= 5) {
    return {
      label: "Upcoming",
      className: "bg-warning/80 text-warning-foreground",
    }
  }

  return {
    label: "Checked in",
    className: "bg-success/80 text-success-foreground",
  }
}

export function SecretCard({ secret }: SecretCardProps) {
  const [statusBadge, setStatusBadge] = useState<StatusBadge>(
    getStatusBadge(secret.next_check_in),
  )
  const [secretState, setSecretState] = useState<Secret>(secret)

  useEffect(() => {
    setStatusBadge(getStatusBadge(secret.next_check_in))
  }, [secret.next_check_in])

  const { toast } = useToast()

  const handleCheckInSuccess = (updatedSecret: Secret) => {
    setSecretState(updatedSecret)
    toast({
      title: "Checked in successfully",
      description: `Your check-in for "${secret.title}" has been recorded.`,
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

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="relative mb-4">
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
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
              statusBadge.className,
            )}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        <div className="flex items-center">
          <Clock className="mr-1 h-4 w-4" />
          Next check-in: {format(secretState.next_check_in)}
        </div>
        {secretState.last_check_in && (
          <div className="text-muted-foreground text-xs">
            Last check-in: {format(secretState.last_check_in)}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      <div className="flex justify-end gap-2">
        <CheckInButton
          secretId={secretState.id}
          onCheckInSuccess={handleCheckInSuccess}
        />
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/secrets/${secretState.id}/edit`}>Edit</Link>
        </Button>
      </div>
    </div>
  )
}
