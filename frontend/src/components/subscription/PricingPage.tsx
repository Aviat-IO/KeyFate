"use client"

import { StaticPricingPage } from "./StaticPricingPage"
import { UserPricingActions } from "./UserPricingActions"
import { Card, CardContent } from "@/components/ui/card"
import { Suspense } from "react"

export function PricingPage() {
  return (
    <div>
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
  )
}
