"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react"

type ConfirmationState =
  | "loading"
  | "success"
  | "error"
  | "invalid_token"
  | "already_processed"

export default function ConfirmDeletionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState<ConfirmationState>("loading")
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    const confirmDeletion = async () => {
      const token = searchParams.get("token")

      if (!token) {
        setState("invalid_token")
        return
      }

      try {
        const response = await fetch("/api/user/delete-account/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (
            data.error?.includes("already processed") ||
            data.error?.includes("already confirmed")
          ) {
            setState("already_processed")
          } else {
            setState("error")
            setErrorMessage(data.error || "Failed to confirm deletion")
          }
          return
        }

        setState("success")
        setScheduledDate(data.scheduledDeletionAt)
      } catch (error) {
        console.error("Error confirming deletion:", error)
        setState("error")
        setErrorMessage("An unexpected error occurred. Please try again.")
      }
    }

    confirmDeletion()
  }, [searchParams])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state === "loading" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Confirming Deletion Request
              </>
            )}
            {state === "success" && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Deletion Confirmed
              </>
            )}
            {(state === "error" ||
              state === "invalid_token" ||
              state === "already_processed") && (
              <>
                <XCircle className="text-destructive h-5 w-5" />
                Confirmation Failed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {state === "loading" && "Processing your deletion request..."}
            {state === "success" && "Your account deletion has been confirmed"}
            {state === "invalid_token" && "The confirmation link is invalid"}
            {state === "already_processed" &&
              "This deletion request has already been processed"}
            {state === "error" && "There was an error confirming your request"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex justify-center py-4">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          )}

          {state === "success" && (
            <div className="space-y-4">
              <div className="bg-destructive/10 border-destructive/50 rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="text-destructive h-5 w-5" />
                  <h3 className="font-semibold">30-Day Grace Period</h3>
                </div>
                <p className="text-sm">
                  Your account is scheduled for deletion on{" "}
                  {scheduledDate && (
                    <strong>{formatDate(scheduledDate)}</strong>
                  )}
                  . You can cancel this request at any time before that date.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">What happens next:</h4>
                <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
                  <li>You can continue using your account normally</li>
                  <li>
                    You can cancel the deletion from your settings at any time
                  </li>
                  <li>
                    After the grace period, all your data will be permanently
                    deleted
                  </li>
                  <li>This action cannot be undone after the scheduled date</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push("/settings/privacy")}
                  className="flex-1"
                >
                  Go to Settings
                </Button>
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="flex-1"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}

          {state === "invalid_token" && (
            <div className="space-y-4">
              <p className="text-sm">
                The confirmation link you used is invalid or has expired. This
                could happen if:
              </p>
              <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
                <li>The link was already used</li>
                <li>The link is corrupted or incomplete</li>
                <li>The deletion request was cancelled</li>
              </ul>
              <Button onClick={() => router.push("/settings/privacy")}>
                Go to Settings
              </Button>
            </div>
          )}

          {state === "already_processed" && (
            <div className="space-y-4">
              <p className="text-sm">
                This deletion request has already been confirmed. You can manage
                your deletion request from your settings page.
              </p>
              <Button onClick={() => router.push("/settings/privacy")}>
                Go to Settings
              </Button>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4">
              <div className="bg-destructive/10 rounded-lg p-4">
                <p className="text-sm">{errorMessage}</p>
              </div>
              <p className="text-muted-foreground text-sm">
                If the problem persists, please contact support.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
                <Button onClick={() => router.push("/settings/privacy")}>
                  Go to Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
