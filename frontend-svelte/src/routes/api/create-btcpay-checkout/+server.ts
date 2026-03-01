import { json, redirect } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { NEXT_PUBLIC_SITE_URL } from "$lib/env"
import { getCryptoPaymentProvider } from "$lib/payment"
import type { Subscription } from "$lib/payment/interfaces/PaymentProvider"
import { getAmount } from "$lib/pricing"

/**
 * GET /api/create-btcpay-checkout
 *
 * Handle post-authentication redirects for BTCPay checkout.
 */
export const GET: RequestHandler = async (event) => {
  const amount = Number(event.url.searchParams.get("amount"))
  const currency = (
    event.url.searchParams.get("currency") || "BTC"
  ).toUpperCase()
  const mode = (event.url.searchParams.get("mode") || "payment") as
    | "payment"
    | "subscription"
  const interval = event.url.searchParams.get(
    "interval",
  ) as Subscription["interval"]
  const redirectAfterAuth = event.url.searchParams.get("redirect_after_auth")

  if (!amount || !redirectAfterAuth) {
    return redirect(303, `${NEXT_PUBLIC_SITE_URL}/pricing`)
  }

  const result = await createBTCPayCheckoutSession(event, {
    amount,
    currency,
    mode,
    interval,
  })

  // After auth redirect, we should redirect to the BTCPay URL instead of returning JSON
  if (redirectAfterAuth === "true") {
    const responseJson = await result.json()
    if (responseJson.url) {
      return redirect(303, responseJson.url)
    }
    // If there's an error, redirect to pricing with error message
    return redirect(
      303,
      `${NEXT_PUBLIC_SITE_URL}/pricing?error=checkout_failed`,
    )
  }

  return result
}

/**
 * POST /api/create-btcpay-checkout
 *
 * Create a BTCPay checkout session via AJAX.
 * Requires CSRF protection and authentication.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const csrfCheck = await requireCSRFProtection(event)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const {
      amount,
      currency = "BTC",
      mode = "payment",
      interval,
    } = await event.request.json()
    return createBTCPayCheckoutSession(event, {
      amount: Number(amount),
      currency,
      mode,
      interval,
    })
  } catch (error) {
    console.error("Error parsing request body:", error)
    return json({ error: "Invalid request body" }, { status: 400 })
  }
}

async function createBTCPayCheckoutSession(
  event: Parameters<RequestHandler>[0],
  params: {
    amount: number
    currency: string
    mode: "payment" | "subscription"
    interval?: Subscription["interval"]
  },
) {
  try {
    const session = await event.locals.auth()
    const user = session?.user
    if (!user?.email || !user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const cryptoPaymentProvider = getCryptoPaymentProvider()

    // Use environment-specific pricing
    let actualAmount = params.amount
    if (params.interval) {
      actualAmount = getAmount(
        params.interval === "month" ? "monthly" : "yearly",
      )
    }

    let btcAmount = actualAmount
    if (
      params.currency.toUpperCase() !== "BTC" &&
      cryptoPaymentProvider.convertToProviderCurrency
    ) {
      btcAmount = await cryptoPaymentProvider.convertToProviderCurrency(
        actualAmount,
        params.currency.toUpperCase(),
      )
    }

    const customerId = await cryptoPaymentProvider.createCustomer(user.email, {
      user_id: user.id,
    })

    const checkoutSession = await cryptoPaymentProvider.createCheckoutSession({
      customerId,
      amount: btcAmount,
      currency: "BTC",
      mode: params.mode,
      successUrl: `${NEXT_PUBLIC_SITE_URL}/dashboard?success=true&provider=btcpay&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${NEXT_PUBLIC_SITE_URL}/pricing?canceled=true&provider=btcpay`,
      expiresInMinutes: 60,
      metadata: {
        user_id: user.id,
        original_amount: String(actualAmount),
        original_currency: params.currency.toUpperCase(),
        ...(params.interval && { billing_interval: params.interval }),
      },
    })

    return json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Error creating BTCPay checkout session:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
