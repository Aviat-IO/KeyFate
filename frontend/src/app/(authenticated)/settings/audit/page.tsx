import { authConfig } from "@/lib/auth-config"
import { AuditLogsPage } from "@/components/audit/AuditLogsPage"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getUserTierInfo } from "@/lib/subscription"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function AuditLogsRoute() {
  const session = (await getServerSession(
    authConfig as Parameters<typeof getServerSession>[0],
  )) as Session | null

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const tierInfo = await getUserTierInfo(session.user.id)
  const userTier = (tierInfo?.tier?.tiers?.name ?? "free") as "free" | "pro"

  if (userTier !== "pro") {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>
              Comprehensive audit trails are a Pro feature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Upgrade to Pro to access comprehensive audit logs that track all
                activities in your account, including:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>Secret creation, editing, and deletion</li>
                <li>Check-in activity</li>
                <li>Recipient management</li>
                <li>Login events</li>
                <li>Subscription changes</li>
                <li>Settings updates</li>
              </ul>
              <div className="flex gap-4 pt-4">
                <Button asChild>
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AuditLogsPage />
    </div>
  )
}
