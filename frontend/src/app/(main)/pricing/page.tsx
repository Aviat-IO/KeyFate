import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { PricingPage } from "@/components/subscription/PricingPage"
import { StaticPricingPage } from "@/components/subscription/StaticPricingPage"
import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"

export default async function Pricing() {
  const session = (await getServerSession(authConfig as any)) as Session | null
  const user = session?.user

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>

      <div className="container mx-auto px-4 py-16">
        {user ? <PricingPage /> : <StaticPricingPage />}
      </div>

      <Footer />
    </div>
  )
}
