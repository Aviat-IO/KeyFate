"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface AuditLog {
  id: string
  eventType: string
  eventCategory: string
  resourceType: string | null
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  details: Record<string, unknown> | null
}

interface AuditLogsPageProps {
  initialLogs?: AuditLog[]
}

export function AuditLogsPage({ initialLogs = [] }: AuditLogsPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [search, _setSearch] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      })

      if (eventTypeFilter) params.append("event_type", eventTypeFilter)
      if (categoryFilter) params.append("event_category", categoryFilter)
      if (startDate) params.append("start_date", startDate.toISOString())
      if (endDate) params.append("end_date", endDate.toISOString())
      if (search) params.append("search", search)

      const response = await fetch(`/api/audit-logs?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch audit logs")

      const data = await response.json()
      setLogs(data.logs)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error("Error fetching audit logs:", error)
    } finally {
      setLoading(false)
    }
  }, [page, eventTypeFilter, categoryFilter, startDate, endDate, search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExport = async (format: "csv" | "json") => {
    try {
      const params = new URLSearchParams({ format })
      if (eventTypeFilter) params.append("event_type", eventTypeFilter)
      if (categoryFilter) params.append("event_category", categoryFilter)
      if (startDate) params.append("start_date", startDate.toISOString())
      if (endDate) params.append("end_date", endDate.toISOString())

      const response = await fetch(
        `/api/audit-logs/export?${params.toString()}`,
      )
      if (!response.ok) throw new Error("Failed to export audit logs")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${new Date().toISOString()}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error exporting audit logs:", error)
    }
  }

  const formatEventType = (eventType: string) => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Select
              value={eventTypeFilter || "all"}
              onValueChange={(value) =>
                setEventTypeFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="secret_created">Secret Created</SelectItem>
                <SelectItem value="secret_edited">Secret Edited</SelectItem>
                <SelectItem value="secret_deleted">Secret Deleted</SelectItem>
                <SelectItem value="check_in">Check In</SelectItem>
                <SelectItem value="secret_triggered">
                  Secret Triggered
                </SelectItem>
                <SelectItem value="recipient_added">Recipient Added</SelectItem>
                <SelectItem value="recipient_removed">
                  Recipient Removed
                </SelectItem>
                <SelectItem value="settings_changed">
                  Settings Changed
                </SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="subscription_changed">
                  Subscription Changed
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter || "all"}
              onValueChange={(value) =>
                setCategoryFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="secrets">Secrets</SelectItem>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="subscriptions">Subscriptions</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="recipients">Recipients</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Start Date"
              value={startDate ? startDate.toISOString().split("T")[0] : ""}
              onChange={(e) =>
                setStartDate(
                  e.target.value ? new Date(e.target.value) : undefined,
                )
              }
              className="w-[200px]"
            />

            <Input
              type="date"
              placeholder="End Date"
              value={endDate ? endDate.toISOString().split("T")[0] : ""}
              onChange={(e) =>
                setEndDate(
                  e.target.value ? new Date(e.target.value) : undefined,
                )
              }
              className="w-[200px]"
            />

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
              >
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatEventType(log.eventType)}</TableCell>
                      <TableCell className="capitalize">
                        {log.eventCategory}
                      </TableCell>
                      <TableCell>
                        {log.resourceType && log.resourceId
                          ? `${log.resourceType}: ${log.resourceId.slice(0, 8)}...`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.ipAddress || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
