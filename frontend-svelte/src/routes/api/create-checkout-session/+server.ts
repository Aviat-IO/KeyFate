import { json, redirect } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { NEXT_PUBLIC_SITE_URL } from "$lib/env"
import { getFiatPaymentProvider } from "$lib/payment"

/**
 * GET /api/create-checkout-session
 *
 * Handle post-authentication redirects for checkout.
 * Redirects to Stripe checkout or back to pricing.
 */
export const GET: RequestHandler = async (event) => {
  const lookupKey = event.url.searchParams.get("lookup_key")
  const redirectAfterAuth = event.url.searchParams.get("redirect_after_auth")

  if (!lookupKey || !redirectAfterAuth) {
    return redirect(303, `${NEXT_PUBLIC_SITE_URL}/pricing`)
  }

  // This is a post-authentication redirect, create checkout session and redirect
  return createCheckoutSession(event, lookupKey, true)
}

/**
 * POST /api/create-checkout-session
 *
 * Create a Stripe checkout session via AJAX.
 * Requires CSRF protection and authentication.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const csrfCheck = await requireCSRFProtection(event)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const { lookup_key } = await event.request.json()
    return createCheckoutSession(event, lookup_key, false)
  } catch (error) {
    console.error("Error parsing request body:", error)
    return json({ error: "Invalid request body" }, { status: 400 })
  }
}

async function createCheckoutSession(
  event: Parameters<RequestHandler>[0],
  lookupKey: string,
  shouldRedirect = false,
) {
  try {
    console.log(`🔍 Creating checkout session for lookup key: ${lookupKey}`)

    // Get user from session
    const session = await event.locals.auth()
    const user = session?.user
    if (!user?.email || !user?.id) {
      console.log("❌ Authentication failed: missing session user")
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`✅ User authenticated: ${user.id}`)

    // Get payment provider
    const fiatPaymentProvider = getFiatPaymentProvider()
    console.log("✅ Payment provider initialized")

    const customerId = await fiatPaymentProvider.createCustomer(user.email!, {
      user_id: user.id,
    })

    // Get price by lookup key
    console.log("🔍 Fetching prices from Stripe...")
    const prices = await fiatPaymentProvider.listPrices()
    console.log(`✅ Found ${prices.length} prices`)

    const price = prices.find((p) => p.lookupKey === lookupKey)

    if (!price) {
      console.log(`❌ Price not found for lookup key: ${lookupKey}`)
      console.log(
        "Available lookup keys:",
        prices.map((p) => p.lookupKey).filter(Boolean),
      )
      return json({ error: "Price not found" }, { status: 404 })
    }

    console.log(
      `✅ Found price: ${price.id} (${price.unitAmount} ${price.currency})`,
    )

    // Create checkout session
    console.log("🛒 Creating Stripe checkout session...")
    const sessionConfig = {
      customerId,
      priceId: price.id,
      mode: "subscription" as const,
      successUrl: `${NEXT_PUBLIC_SITE_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
      billingAddressCollection: "auto" as const,
      automaticTax: { enabled: false },
      locale: "en" as const,
      metadata: {
        user_id: user.id,
      },
    }

    if (process.env.NODE_ENV === "development") {
      console.log("Session config:", {
        mode: sessionConfig.mode,
        successUrl: sessionConfig.successUrl,
        cancelUrl: sessionConfig.cancelUrl,
      })
    }

    const checkoutSession =
      await fiatPaymentProvider.createCheckoutSession(sessionConfig)

    console.log(`✅ Checkout session created: ${checkoutSession.id}`)
    console.log(`🔗 Checkout URL: ${checkoutSession.url}`)

    // For GET requests (post-auth), redirect directly to Stripe
    // For POST requests (AJAX), return JSON
    if (shouldRedirect) {
      return redirect(303, checkoutSession.url)
    }

    return json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    })
  } catch (error) {
    console.error("❌ Error creating checkout session:", error)

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }

    // Return more specific error information
    return json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
