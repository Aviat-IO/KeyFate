import type { Session } from "next-auth"
import { authConfig } from "@/lib/auth-config"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { getDatabase } from "@/lib/db/drizzle"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

export default async function GeneralSettingsPage() {
  const session = (await getServerSession(authConfig)) as Session | null

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const userId = session.user.id
  const db = await getDatabase()

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown"

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="General Settings"
        description="View your account information"
      />

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your KeyFate account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-muted-foreground text-sm font-medium">
              Name
            </label>
            <p className="text-lg">{user?.name || "Not set"}</p>
          </div>
          <div>
            <label className="text-muted-foreground text-sm font-medium">
              Email
            </label>
            <p className="text-lg">{user?.email}</p>
          </div>
          <div>
            <label className="text-muted-foreground text-sm font-medium">
              Joined
            </label>
            <p className="text-lg">{joinDate}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
