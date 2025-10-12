import { authConfig } from "@/lib/auth-config"
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env"
import { getFiatPaymentProvider } from "@/lib/payment"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    // Get user from NextAuth
    const session = (await getServerSession(
      authConfig as any,
    )) as Session | null
    const user = session?.user
    if (!user?.email || !(user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider()

    // Create billing portal session using user metadata/customer mapping as needed
    const portalSession = await fiatPaymentProvider.createBillingPortalSession!(
      // Use email to resolve customer; implementation inside provider should map email->customer
      user.email,
      `${NEXT_PUBLIC_SITE_URL}/profile`,
    )

    return NextResponse.redirect(portalSession.url, 303)
  } catch (error) {
    console.error("Error creating portal session:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
      },
    )
  }
}
