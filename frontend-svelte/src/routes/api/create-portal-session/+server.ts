import { json, redirect } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { NEXT_PUBLIC_SITE_URL } from "$lib/env"
import { getFiatPaymentProvider } from "$lib/payment"

/**
 * POST /api/create-portal-session
 *
 * Create a Stripe billing portal session and redirect.
 * Requires CSRF protection and authentication.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const csrfCheck = await requireCSRFProtection(event.request as any)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    const user = session?.user
    if (!user?.email || !user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider()

    // Create billing portal session using user email to resolve customer
    const portalSession = await fiatPaymentProvider.createBillingPortalSession!(
      user.email,
      `${NEXT_PUBLIC_SITE_URL}/profile`,
    )

    return redirect(303, portalSession.url)
  } catch (error) {
    console.error("Error creating portal session:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
