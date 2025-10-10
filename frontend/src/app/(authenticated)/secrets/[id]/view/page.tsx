import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authConfig } from "@/lib/auth-config"
import { getSecret } from "@/lib/db/operations"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  History,
  Mail,
  Pause,
  Phone,
  Shield,
  User,
} from "lucide-react"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

interface ViewSecretPageProps {
  params: Promise<{ id: string }>
}

export default async function ViewSecretPage({ params }: ViewSecretPageProps) {
  const { id } = await params
  const session = (await getServerSession(authConfig as any)) as Session | null

  if (!session?.user) {
    redirect("/auth/signin")
  }

  try {
    const secret = await getSecret(id, session.user.id)
    if (!secret) {
      notFound()
    }

    // TODO: Implement check-in history with Drizzle
    const checkInHistory: any[] = []
    // const { data: checkInHistory } = await supabase
    //   .from("checkin_history")
    //   .select("checked_in_at, next_check_in")
    //   .eq("secret_id", id)
    //   .eq("user_id", user.id)
    //   .order("checked_in_at", { ascending: false })

    const primaryRecipient = secret.recipients.find(r => r.isPrimary) || secret.recipients[0]

    // Get status icon and color
    const getStatusInfo = () => {
      // If triggered (has triggeredAt or status is triggered), show triggered status
      if (secret.triggeredAt || secret.status === "triggered") {
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
          label: "sent",
        }
      }

      switch (secret.status) {
        case "active":
          return {
            icon: CheckCircle,
            color:
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            label: "active",
          }
        case "paused":
          return {
            icon: Pause,
            color:
              "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
            label: "paused",
          }
        default:
          return {
            icon: AlertCircle,
            color:
              "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
            label: "unknown",
          }
      }
    }

    const statusInfo = getStatusInfo()
    const StatusIcon = statusInfo.icon

    return (
      <div className="mx-auto max-w-4xl py-8 sm:px-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <FileText className="text-primary h-8 w-8" />
              {secret.title}
            </h1>
            <p className="text-muted-foreground">Secret Details</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Secret Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Secret Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Recipients ({secret.recipients.length})</p>
                    <div className="space-y-2">
                      {secret.recipients.map((recipient) => (
                        <div key={recipient.id} className="flex items-center gap-2 text-sm">
                          {recipient.isPrimary && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                          <span className="font-medium">{recipient.name}</span>
                          <span className="text-muted-foreground">•</span>
                          {recipient.email && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {recipient.email}
                            </span>
                          )}
                          {recipient.phone && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {recipient.phone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status and Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Status & Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <StatusIcon className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant="secondary" className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Check-in Interval</p>
                    <p className="text-muted-foreground text-sm">
                      {secret.checkInDays} days
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Check-in History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Check-in History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checkInHistory && checkInHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check-in Date</TableHead>
                      <TableHead>Next Check-in Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkInHistory.map((checkIn, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {new Date(
                              checkIn.checked_in_at,
                            ).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(
                              checkIn.checked_in_at,
                            ).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="text-muted-foreground h-4 w-4" />
                            {new Date(
                              checkIn.next_check_in,
                            ).toLocaleDateString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center">
                  <History className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">
                    No check-in history available.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } catch (error) {
    notFound()
  }
}
