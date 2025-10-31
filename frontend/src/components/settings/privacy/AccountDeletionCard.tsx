"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Trash2, Loader2, Clock, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { AccountDeletionRequest } from "@/lib/db/schema"

interface AccountDeletionCardProps {
  userId: string
  userEmail: string
  activeDeletionRequest: AccountDeletionRequest | null
}

export function AccountDeletionCard({
  activeDeletionRequest,
}: AccountDeletionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const { toast } = useToast()

  const handleRequestDeletion = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-reauth-token": "mock-token", // TODO: Implement proper OTP re-authentication
        },
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === "ALREADY_PENDING") {
          toast({
            title: "Deletion Already Pending",
            description: data.error,
            variant: "destructive",
          })
        } else {
          throw new Error(data.error || "Failed to request deletion")
        }
        return
      }

      toast({
        title: "Deletion Requested",
        description:
          "Check your email to confirm the deletion request. You'll have 30 days to cancel.",
      })

      // Delay reload to allow toast to be visible
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to request account deletion",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDeletion = async () => {
    if (!activeDeletionRequest) return

    setIsCancelling(true)
    try {
      const response = await fetch(
        `/api/user/delete-account/cancel/${activeDeletionRequest.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel deletion")
      }

      toast({
        title: "Deletion Cancelled",
        description: "Your account deletion request has been cancelled.",
      })

      // Refresh the page
      window.location.reload()
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to cancel deletion request",
        variant: "destructive",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getDaysRemaining = (scheduledDate: Date | null) => {
    if (!scheduledDate) return 0
    const now = new Date()
    const scheduled = new Date(scheduledDate)
    const diffTime = scheduled.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeDeletionRequest ? (
          <div className="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              {activeDeletionRequest.status === "pending" ? (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Pending Confirmation
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Scheduled for Deletion
                </Badge>
              )}
            </div>

            {activeDeletionRequest.status === "pending" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Deletion request pending email confirmation
                </p>
                <p className="text-muted-foreground text-sm">
                  Check your email and click the confirmation link to proceed
                  with deletion.
                </p>
              </div>
            )}

            {activeDeletionRequest.status === "confirmed" &&
              activeDeletionRequest.scheduledDeletionAt && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Account scheduled for deletion on{" "}
                    {formatDate(activeDeletionRequest.scheduledDeletionAt)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {getDaysRemaining(
                      activeDeletionRequest.scheduledDeletionAt,
                    )}{" "}
                    days remaining in grace period. You can cancel this request
                    at any time before the scheduled date.
                  </p>
                </div>
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="mt-4"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Deletion Request
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                What happens when you delete your account:
              </h4>
              <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
                <li>
                  All your secrets and check-in data will be permanently deleted
                </li>
                <li>Your audit logs and activity history will be removed</li>
                <li>Any pending data exports will be cancelled</li>
                <li>Your subscription will be immediately cancelled</li>
                <li>You'll have a 30-day grace period to change your mind</li>
              </ul>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      This will initiate the account deletion process. You'll
                      receive an email to confirm your decision.
                    </p>
                    <p className="text-destructive font-medium">
                      After confirmation, you'll have 30 days to cancel before
                      all your data is permanently deleted.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRequestDeletion}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Yes, Delete My Account"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
