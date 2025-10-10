import { NewSecretForm } from "@/components/forms/newSecretForm"
import { getUserTierInfo } from "@/lib/subscription"
import { authConfig } from "@/lib/auth-config"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"

export default async function NewSecretPage() {
  const session = await getServerSession(authConfig as any) as Session | null
  
  if (!session?.user?.id) {
    redirect("/sign-in")
  }
  
  const tierInfo = await getUserTierInfo(session.user.id)
  
  if (!tierInfo) {
    return (
      <div className="mx-auto sm:px-4 py-8 max-w-3xl">
        <h1 className="mb-8 text-2xl font-bold text-left">Create New Secret</h1>
        <p className="text-muted-foreground">Unable to load tier information. Please try again.</p>
      </div>
    )
  }
  
  return (
    <div className="mx-auto sm:px-4 py-8 max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold text-left">Create New Secret</h1>
      <NewSecretForm 
        isPaid={tierInfo.tier.tiers.name === "pro"}
        tierInfo={{
          secretsUsed: tierInfo.limits.secrets.current,
          secretsLimit: tierInfo.limits.secrets.max,
          canCreate: tierInfo.limits.secrets.canCreate,
          recipientsLimit: tierInfo.limits.recipients.max,
        }}
      />
    </div>
  )
}
