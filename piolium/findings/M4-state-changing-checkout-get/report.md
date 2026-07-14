# M4 — Cross-site GET requests create payment-provider objects

Severity: MEDIUM
Verdict: VALID
PoC-Status: theoretical
PoC-Block-Reason: No disposable Stripe/BTCPay production account was available for safe provider-side execution.

## Summary

Authenticated GET endpoints create Stripe customers/checkout sessions and BTCPay invoices. SameSite=Lax cookies are sent on top-level cross-site navigation, while SvelteKit's form-origin CSRF check does not protect GET.

## Location

- `frontend/src/routes/api/create-checkout-session/+server.ts:14-23,55-120`
- `frontend/src/lib/payment/providers/StripeProvider.ts:31-49`
- `frontend/src/routes/api/create-btcpay-checkout/+server.ts:14-42,81-126`

## Attacker prerequisites

An authenticated victim follows or is navigated to an attacker-crafted URL. No payment completes without victim/provider confirmation.

## Evidence

The GET handler treats query parameters as authority to call the same creation function used by protected POST. Stripe customer creation happens before lookup-key validation. There is no CSRF/origin check, provider idempotency key, rate limit, or customer reuse on this path.

## Impact

Unbounded provider-side customer/session/invoice creation, third-party cost/noise, forced navigation, and billing-state confusion attributed to the victim.

## Reproduction

See `poc.md`.
