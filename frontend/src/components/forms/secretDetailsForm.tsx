"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { format } from "timeago.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Secret {
  id: string
  title: string
  recipient_name: string
  recipient_email: string | null
  recipient_phone: string | null
  contact_method: "email" | "phone" | "both"
  check_in_days: number
  last_check_in: string | null
  next_check_in: string | null
  status: "active" | "paused" | "triggered"
  sss_shares_total: number
  sss_threshold: number
  server_share: string | null
  created_at: string
  updated_at: string
}

interface SecretDetailsFormProps {
  secret: Secret
}

export function SecretDetailsForm({ secret }: SecretDetailsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverShare, setServerShare] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRevealDialog, setShowRevealDialog] = useState(false)
  const [serverShareDeleted, setServerShareDeleted] = useState(
    !secret.server_share,
  )

  const handleRevealServerShare = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/secrets/${secret.id}/reveal-server-share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to reveal server share")
      }

      const { serverShare: share } = await response.json()
      setServerShare(share)
      setShowRevealDialog(false)
    } catch (error) {
      console.error("Error revealing server share:", error)
      setError(
        error instanceof Error
          ? error.message
          : "Failed to reveal server share",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteServerShare = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/secrets/${secret.id}/delete-server-share`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete server share")
      }

      setServerShareDeleted(true)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error("Error deleting server share:", error)
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete server share",
      )
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {serverShareDeleted && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Secret Disabled:</strong> The server share has been deleted
            and this secret has been automatically paused. No reminder emails
            will be sent. The secret serves only as a record of what was created
            and to whom it was sent. The other shares can still be used to
            reconstruct the secret if needed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{secret.title}</CardTitle>
            <Badge
              variant={secret.status === "active" ? "default" : "secondary"}
            >
              {secret.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shamir's Secret Sharing Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="mb-3 flex items-center font-medium">
              <Shield className="mr-2 h-4 w-4" />
              Secret Configuration
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Shares:</span>
                <span className="ml-2 font-medium">
                  {secret.sss_shares_total}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Threshold:</span>
                <span className="ml-2 font-medium">{secret.sss_threshold}</span>
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Your secret was split into {secret.sss_shares_total} shares. Any{" "}
              {secret.sss_threshold} shares can reconstruct the original secret.
            </p>
          </div>

          <Separator />

          {/* Recipient Information */}
          <div>
            <h3 className="mb-3 flex items-center font-medium">
              <User className="mr-2 h-4 w-4" />
              Recipient Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <User className="text-muted-foreground mr-2 h-4 w-4" />
                <span>{secret.recipient_name}</span>
              </div>
              {secret.recipient_email && (
                <div className="flex items-center">
                  <Mail className="text-muted-foreground mr-2 h-4 w-4" />
                  <span>{secret.recipient_email}</span>
                </div>
              )}
              {secret.recipient_phone && (
                <div className="flex items-center">
                  <Phone className="text-muted-foreground mr-2 h-4 w-4" />
                  <span>{secret.recipient_phone}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Check-in Information */}
          <div>
            <h3 className="mb-3 flex items-center font-medium">
              <Clock className="mr-2 h-4 w-4" />
              Check-in Schedule
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Frequency:</span>
                <span className="ml-2 font-medium">
                  Every {secret.check_in_days} days
                </span>
              </div>
              {secret.last_check_in && (
                <div>
                  <span className="text-muted-foreground">Last check-in:</span>
                  <span className="ml-2">{format(secret.last_check_in)}</span>
                </div>
              )}
              {secret.next_check_in && (
                <div>
                  <span className="text-muted-foreground">
                    Next check-in due:
                  </span>
                  <span className="ml-2">{format(secret.next_check_in)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Server Share Management */}
          <div>
            <h3 className="mb-3 flex items-center font-medium">
              <Shield className="mr-2 h-4 w-4" />
              Server Share Management
            </h3>

            {!serverShareDeleted ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  The server holds one of your {secret.sss_shares_total} shares.
                  You can reveal it for recovery purposes or delete it for
                  additional security.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Dialog
                    open={showRevealDialog}
                    onOpenChange={setShowRevealDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" />
                        Reveal Server Share
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reveal Server Share</DialogTitle>
                        <DialogDescription>
                          This will decrypt and show you the server's share.
                          Only do this if you need it for recovery purposes.
                          This share can be combined with other shares to reveal
                          your secret.
                        </DialogDescription>
                      </DialogHeader>
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Warning:</strong> Once revealed, this share
                          can be combined with {secret.sss_threshold - 1} other
                          share(s) to reconstruct your secret. Only proceed if
                          you're doing this for legitimate recovery reasons.
                        </AlertDescription>
                      </Alert>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowRevealDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleRevealServerShare}
                          disabled={loading}
                        >
                          {loading ? "Revealing..." : "Yes, Reveal Share"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={showDeleteDialog}
                    onOpenChange={setShowDeleteDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Server Share
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Server Share</DialogTitle>
                        <DialogDescription>
                          This will permanently delete the server's share. The
                          other shares can still be used to reconstruct the
                          secret.
                        </DialogDescription>
                      </DialogHeader>
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Warning:</strong> After deletion, the server
                          will no longer be able to provide its share to
                          recipients. However, if you or recipients have{" "}
                          {secret.sss_threshold} shares, the secret can still be
                          reconstructed.
                        </AlertDescription>
                      </Alert>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteServerShare}
                          disabled={loading}
                        >
                          {loading ? "Deleting..." : "Yes, Delete Share"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Server share has been deleted. The server can no longer
                  provide its share to recipients.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Revealed Server Share */}
          {serverShare && (
            <div>
              <h3 className="text-destructive mb-3 flex items-center font-medium">
                <Eye className="mr-2 h-4 w-4" />
                Revealed Server Share
              </h3>
              <Alert variant="destructive" className="mb-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This is your server's share. Keep it secure and only use it
                  for legitimate recovery purposes.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Textarea
                  value={serverShare}
                  readOnly
                  className="font-mono text-xs"
                  rows={3}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(serverShare)}
                >
                  Copy Share
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Metadata */}
          <div className="text-muted-foreground text-xs">
            <div className="flex items-center">
              <Calendar className="mr-2 h-3 w-3" />
              Created {format(secret.created_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}
