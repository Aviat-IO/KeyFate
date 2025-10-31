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
import { Download, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { DataExportJob } from "@/lib/db/schema"

interface DataExportCardProps {
  userId: string
  userEmail: string
  recentExports: DataExportJob[]
}

export function DataExportCard({ recentExports }: DataExportCardProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const { toast } = useToast()

  const handleRequestExport = async () => {
    setIsRequesting(true)
    try {
      const response = await fetch("/api/user/export-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === "RATE_LIMITED") {
          toast({
            title: "Rate Limited",
            description: data.error,
            variant: "destructive",
          })
        } else {
          throw new Error(data.error || "Failed to request export")
        }
        return
      }

      toast({
        title: "Export Requested",
        description:
          "Your data export has been queued. You'll receive an email when it's ready.",
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
            : "Failed to request data export",
        variant: "destructive",
      })
    } finally {
      setIsRequesting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Ready
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A"
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(2)} MB`
  }

  const isExpired = (expiresAt: Date) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Your Data</CardTitle>
        <CardDescription>
          Download a complete copy of your personal data in JSON format. This
          includes your secrets, check-in history, audit logs, and subscription
          information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-muted-foreground text-sm">
                Exports are available for 24 hours and can be downloaded up to 3
                times. You can request one export every 24 hours.
              </p>
            </div>
            <Button
              onClick={handleRequestExport}
              disabled={isRequesting}
              className="shrink-0"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Request Export
                </>
              )}
            </Button>
          </div>

          {recentExports.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium">Recent Exports</h4>
              <div className="space-y-2">
                {recentExports.map((exportJob) => (
                  <div
                    key={exportJob.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(exportJob.status)}
                        <span className="text-muted-foreground text-xs">
                          Requested {formatDate(exportJob.createdAt)}
                        </span>
                      </div>
                      {exportJob.fileSize && (
                        <span className="text-muted-foreground text-xs">
                          Size: {formatFileSize(exportJob.fileSize)} •
                          Downloads: {exportJob.downloadCount || 0}/3
                        </span>
                      )}
                      {exportJob.expiresAt && (
                        <span
                          className={`text-xs ${
                            isExpired(exportJob.expiresAt)
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isExpired(exportJob.expiresAt)
                            ? "Expired"
                            : `Expires ${formatDate(exportJob.expiresAt)}`}
                        </span>
                      )}
                    </div>
                    {exportJob.status === "completed" &&
                      exportJob.fileUrl &&
                      !isExpired(exportJob.expiresAt) &&
                      (exportJob.downloadCount || 0) < 3 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (exportJob.fileUrl) {
                              window.open(exportJob.fileUrl, "_blank")
                            }
                          }}
                        >
                          <Download className="mr-2 h-3 w-3" />
                          Download
                        </Button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
