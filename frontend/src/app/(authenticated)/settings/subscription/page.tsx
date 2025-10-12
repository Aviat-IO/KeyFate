import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { getUserTierInfo } from "@/lib/subscription"
import { SubscriptionManagement } from "@/components/settings/SubscriptionManagement"

export default async function SubscriptionSettingsPage() {
  const session = (await getServerSession(authConfig as any)) as Session | null

  if (!session?.user) {
    redirect("/sign-in")
  }

  const userId = (session.user as any).id
  const tierInfo = await getUserTierInfo(userId)

  if (!tierInfo) {
    return <div>Error loading subscription information</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      <SubscriptionManagement tierInfo={tierInfo} />
    </div>
  )
}
