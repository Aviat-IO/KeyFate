import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { getUserTierInfo } from "@/lib/subscription"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/components/settings/SettingsNav"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = (await getServerSession(authConfig as any)) as Session | null

  if (!session?.user) {
    redirect("/sign-in")
  }

  const userId = (session.user as any).id
  const tierInfo = await getUserTierInfo(userId)
  const isProUser = tierInfo?.tier?.tiers?.name === "pro"

  return (
    <div className="mx-auto py-8 sm:px-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1px_1fr]">
        <aside className="md:col-span-1">
          <SettingsNav isProUser={isProUser} />
        </aside>
        <Separator orientation="vertical" className="hidden h-auto md:block" />
        <main className="md:col-span-1">{children}</main>
      </div>
    </div>
  )
}
