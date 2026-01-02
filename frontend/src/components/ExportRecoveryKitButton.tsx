"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  downloadRecoveryKit,
  getUserManagedSharesFromStorage,
  type RecoveryKitData,
  type SecretMetadata,
} from "@/lib/export-recovery-kit"
import { AlertCircle, Download, Loader2, ShieldCheck } from "lucide-react"
import { useCallback, useState } from "react"

interface ExportRecoveryKitButtonProps {
  secret: {
    id: string
    title: string
    checkInDays: number
    createdAt: Date | string
    recipients: Array<{
      id: string
      name: string
      email: string | null
      phone: string | null
    }>
  }
  threshold: number
  totalShares: number
  className?: string
}

export function ExportRecoveryKitButton({
  secret,
  threshold,
  totalShares,
  className,
}: ExportRecoveryKitButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setError(null)
    setSuccess(false)

    try {
      // Fetch decrypted server share from API
      const response = await fetch(`/api/secrets/${secret.id}/export-share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 401) {
          throw new Error("Session expired. Please log in again.")
        }
        if (response.status === 403) {
          throw new Error("Re-authentication required. Please verify your identity.")
        }
        if (response.status === 404) {
          throw new Error("Server share not found or has been deleted.")
        }
        throw new Error(errorData.error || "Failed to retrieve server share")
      }

      const shareData = await response.json()
      const serverShare = shareData.serverShare

      // Get user-managed shares from localStorage
      const userManagedShares = getUserManagedSharesFromStorage(secret.id)

      // Build recovery kit data
      const metadata: SecretMetadata = {
        id: secret.id,
        title: secret.title,
        threshold,
        totalShares,
        checkInDays: secret.checkInDays,
        recipients: secret.recipients.map((r) => ({
          name: r.name,
          email: r.email || "",
        })),
        createdAt:
          typeof secret.createdAt === "string"
            ? secret.createdAt
            : secret.createdAt.toISOString(),
        exportedAt: new Date().toISOString(),
      }

      const recoveryKitData: RecoveryKitData = {
        metadata,
        serverShare,
        userManagedShares,
      }

      // Generate and download the recovery kit
      await downloadRecoveryKit(recoveryKitData)

      setSuccess(true)

      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false)
        setSuccess(false)
      }, 2000)
    } catch (err) {
      console.error("Export error:", err)
      setError(err instanceof Error ? err.message : "Failed to export recovery kit")
    } finally {
      setIsExporting(false)
    }
  }, [secret, threshold, totalShares])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Download className="mr-2 h-4 w-4" />
          Export Recovery Kit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Export Recovery Kit
          </DialogTitle>
          <DialogDescription>
            Download a complete backup of your secret that works without KeyFate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="mb-2 font-medium">This kit includes:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Standalone recovery tool (works offline)</li>
              <li>• Server share (decrypted)</li>
              <li>• Your user-managed shares (if available)</li>
              <li>• Secret metadata and instructions</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <h4 className="font-medium text-amber-700 dark:text-amber-400">
                  Security Notice
                </h4>
                <p className="text-sm text-amber-600 dark:text-amber-300">
                  Store this file securely. Anyone with this kit and enough shares
                  can reconstruct your secret.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <p className="text-sm text-green-700 dark:text-green-400">
                Recovery kit downloaded successfully!
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Kit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
