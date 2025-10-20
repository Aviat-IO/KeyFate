import type { Session } from "next-auth"
import { authConfig } from "@/lib/auth-config"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { getUserTierInfo } from "@/lib/subscription"
import { SubscriptionManagement } from "@/components/settings/SubscriptionManagement"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

export default async function SubscriptionSettingsPage() {
  const session = (await getServerSession(authConfig)) as Session | null

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const userId = session.user.id
  const tierInfo = await getUserTierInfo(userId)

  if (!tierInfo) {
    return <div>Error loading subscription information</div>
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Subscription"
        description="Manage your subscription and billing"
      />

      <SubscriptionManagement tierInfo={tierInfo} />
    </div>
  )
}
