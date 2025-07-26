import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Clock,
  Calendar,
  History,
  Shield,
  FileText,
  CheckCircle,
  AlertCircle,
  Pause
} from "lucide-react"

interface ViewSecretPageProps {
  params: Promise<{ id: string }>
}

export default async function ViewSecretPage({ params }: ViewSecretPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: secret, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !secret) {
    notFound()
  }

  // Fetch check-in history
  const { data: checkInHistory } = await supabase
    .from("checkin_history")
    .select("checked_in_at, next_check_in")
    .eq("secret_id", id)
    .eq("user_id", user.id)
    .order("checked_in_at", { ascending: false })

  // Get contact information based on contact method
  const getContactInfo = () => {
    switch (secret.contact_method) {
      case "email":
        return secret.recipient_email
      case "phone":
        return secret.recipient_phone
      case "both":
        return `${secret.recipient_email} / ${secret.recipient_phone}`
      default:
        return "Not specified"
    }
  }

  // Get status icon and color
  const getStatusInfo = () => {
        // If is_triggered is true, show triggered status regardless of status field
    if (secret.is_triggered) {
      return {
        icon: AlertCircle,
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        label: "sent"
      }
    }

    switch (secret.status) {
      case "active":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
          label: "active"
        }
      case "paused":
        return {
          icon: Pause,
          color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
          label: "paused"
        }
            case "triggered":
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
          label: "sent"
        }
      default:
        return {
          icon: AlertCircle,
          color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
          label: "unknown"
        }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Recipient</p>
                  <p className="text-sm text-muted-foreground">{secret.recipient_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 mt-0.5">
                  {secret.contact_method === "email" && <Mail className="h-4 w-4 text-muted-foreground" />}
                  {secret.contact_method === "phone" && <Phone className="h-4 w-4 text-muted-foreground" />}
                  {secret.contact_method === "both" && (
                    <>
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Contact Details</p>
                  <p className="text-sm text-muted-foreground">{getContactInfo()}</p>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <StatusIcon className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge variant="secondary" className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Check-in Interval</p>
                  <p className="text-sm text-muted-foreground">{secret.check_in_days} days</p>
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
                          {new Date(checkIn.checked_in_at).toLocaleDateString()} at{" "}
                          {new Date(checkIn.checked_in_at).toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(checkIn.next_check_in).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No check-in history available.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
