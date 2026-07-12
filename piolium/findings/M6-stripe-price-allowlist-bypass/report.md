# M6 — Stripe checkout accepts any active recurring price and may grant Pro

Severity: MEDIUM
Verdict: VALID (configuration-dependent exploitability)
PoC-Status: blocked
PoC-Block-Reason: Live Stripe catalog contents and a disposable payment account were not available.

## Summary

The attacker controls `lookup_key`. The server lists every active Stripe price without a product filter and accepts the first matching key. `checkout.session.completed` grants Pro without validating the selected price, product, amount, currency, or interval.

## Location

- `frontend/src/routes/api/create-checkout-session/+server.ts:73-92`
- `frontend/src/lib/payment/providers/StripeProvider.ts:265-280`
- `frontend/src/lib/services/webhook-handlers.ts:94-180`

## Attacker prerequisites

A cheaper active recurring price must exist in the same live Stripe account and its lookup key must be known or guessed. The repository cannot establish current catalog contents.

## Evidence

Checkout completion creates a Pro subscription directly. Subscription-created/updated events later map unknown prices to free, but event order is not enforced. A temporary or persistent Pro grant remains possible when checkout completion arrives first or the correcting event is absent/fails.

## Impact

Underpayment for Pro entitlement and entitlement inconsistency across webhook order/failure cases.

## Reproduction

See `poc.md`.
