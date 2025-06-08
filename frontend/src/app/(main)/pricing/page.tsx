import { Suspense } from "react"
import { StaticPricingPage } from "@/components/subscription/StaticPricingPage"
import { UserPricingActions } from "@/components/subscription/UserPricingActions"
import { Card, CardContent } from "@/components/ui/card"
import { NavBar } from "@/components/nav-bar"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { Database } from "@/types"

export default async function PricingPage() {
  // Get user for navbar
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({
    // @ts-expect-error - Supabase auth helpers expect different cookie format
    cookies: () => cookieStore,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="bg-background min-h-screen">
      <NavBar user={user} />

      <div className="container mx-auto px-4 py-8">
        {/* Static pricing information - works without authentication */}
        <StaticPricingPage />

        {/* User-specific actions - only loads for authenticated users */}
        <div className="mx-auto mt-12 max-w-2xl">
          <Suspense
            fallback={
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="bg-muted h-4 w-3/4 rounded"></div>
                    <div className="bg-muted h-10 w-full rounded"></div>
                    <div className="bg-muted h-4 w-1/2 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <UserPricingActions />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
