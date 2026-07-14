## Review

### TRUE POSITIVE — MEDIUM: Stripe price allowlist bypass

- `lookup_key` is attacker-controlled. Checkout loads **all active Stripe prices** without a product filter, then accepts the first matching lookup key (`frontend/src/routes/api/create-checkout-session/+server.ts:73-92`; `frontend/src/lib/payment/providers/StripeProvider.ts:265-280`).
- The route does not verify the price ID, product, amount, currency, recurring interval, or expected Pro lookup keys before creating a subscription-mode Checkout Session.
- On `checkout.session.completed`, any subscription is blindly recorded as active **Pro** without retrieving or validating its price (`frontend/src/lib/services/webhook-handlers.ts:94-140`).
- Thus an authenticated user who knows or guesses the lookup key of another cheaper active recurring price in the same live Stripe account can pay that price and receive Pro entitlement.

#### Webhook ordering

`customer.subscription.created/updated` does inspect the first subscription price and maps unknown prices to `free` (`frontend/src/lib/services/webhook-handlers.ts:151-180`; `frontend/src/lib/services/tier-service.ts:128-159`).

This does not eliminate the finding:

1. If `subscription.created` arrives first, it records `free`; later checkout completion only sets status active and preserves free.
2. If checkout completion arrives first, it grants Pro until the subscription event arrives and corrects it to free.
3. Stripe event ordering is not enforced in code. Each event is independently deduplicated, with no sequencing or event-created comparison.
4. Pro can persist if subscription events are not configured, delivery repeatedly fails, or processing fails after checkout completion. Invoice success does not independently revalidate the tier.

**Prerequisites:** another cheaper active recurring price must exist in the same live Stripe account, and the attacker must know or guess its lookup key. The repository cannot prove current live Stripe catalog contents, so present production exploitability remains configuration-dependent.

### BTCPay: separate conditional underpayment path

BTCPay has a distinct currency-confusion issue:

- With any truthy `interval`, the server replaces the amount with numeric production pricing—9 or 90—but interprets that number in the attacker-controlled `currency` (`frontend/src/routes/api/create-btcpay-checkout/+server.ts:89-103`).
- For example, `interval=month&currency=JPY` attempts to convert **9 JPY**, not USD 9, into BTC.
- On settlement, entitlement checks only for `billing_interval` and grants Pro without comparing invoice amount/currency against expected pricing (`frontend/src/lib/services/webhook-handlers.ts:265-315`).

This is conditional on BTCPay accepting the resulting invoice above its minimum. There is also an integration caveat: the webhook route fetches the full invoice only to obtain `user_id` but passes the original abbreviated webhook object to the entitlement handler (`frontend/src/routes/api/webhooks/btcpay/+server.ts:73-96,220-235`). If BTCPay’s raw webhook omits metadata as the route comments state, no subscription is granted at all. Therefore the underpayment logic is present, but live exploitability requires the entitlement path to receive invoice metadata.

`pricing.ts` provides no attacker-controlled standalone bypass. It returns 9/90 for a correctly configured production `SITE_URL`; a missing or misclassified production URL would instead enable test pricing, but that is a deployment misconfiguration prerequisite (`frontend/src/lib/pricing.ts:17-50`).