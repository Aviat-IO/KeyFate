import type { Session } from "next-auth"
import { authConfig } from "@/lib/auth-config"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { DataExportCard } from "@/components/settings/privacy/DataExportCard"
import { AccountDeletionCard } from "@/components/settings/privacy/AccountDeletionCard"
import { getDatabase } from "@/lib/db/get-database"
import { dataExportJobs, accountDeletionRequests } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export default async function PrivacySettingsPage() {
  const session = (await getServerSession(authConfig)) as Session | null

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const userId = session.user.id
  const db = await getDatabase()

  // Get recent export jobs
  const recentExports = await db
    .select()
    .from(dataExportJobs)
    .where(eq(dataExportJobs.userId, userId))
    .orderBy(desc(dataExportJobs.createdAt))
    .limit(5)

  // Get active deletion request
  const [activeDeletion] = await db
    .select()
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.userId, userId))
    .orderBy(desc(accountDeletionRequests.createdAt))
    .limit(1)

  // Only show deletion request if it's pending or confirmed
  const activeDeletionRequest =
    activeDeletion &&
    (activeDeletion.status === "pending" ||
      activeDeletion.status === "confirmed")
      ? activeDeletion
      : null

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Data & Privacy"
        description="Manage your personal data, exports, and account deletion"
      />

      <DataExportCard
        userId={userId}
        userEmail={session.user.email || ""}
        recentExports={recentExports}
      />

      <AccountDeletionCard
        userId={userId}
        userEmail={session.user.email || ""}
        activeDeletionRequest={activeDeletionRequest}
      />
    </div>
  )
}
