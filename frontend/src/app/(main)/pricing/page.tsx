import { StaticPricingPage } from "@/components/subscription/StaticPricingPage"
import { PricingPage } from "@/components/subscription/PricingPage"
import { NavBar } from "@/components/nav-bar"
import { Footer } from "@/components/footer"
import { createClient } from "@/utils/supabase/server"

export default async function Pricing() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
