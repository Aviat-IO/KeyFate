## Why

After completing a test payment with Stripe to upgrade to Pro, the UI does not reflect the Pro tier status and no records appear in `payment_history` or `user_subscriptions` tables. This suggests a critical failure in the payment webhook integration that prevents subscriptions from being properly recorded and activated. This issue likely affects both Stripe and BTCPay Server integrations.

## What Changes

- **Comprehensive audit** of the Stripe payment flow from checkout session creation through webhook event handling
- **Comprehensive audit** of the BTCPay Server payment flow for Bitcoin payments
- **Database verification** to ensure payment records and subscription records are created correctly
- **UI state synchronization** to ensure real-time tier status updates after successful payment
- **Test payment validation** to verify the complete payment-to-upgrade flow works end-to-end
- **Error logging** to capture and surface payment integration failures for debugging

## Impact

**Affected specs:**
- `payment-integration` (new spec to be created)
- `subscription-management`
- `tier-enforcement-audit`
- `pro-tier-features`

**Affected code:**
- `frontend/src/app/api/webhooks/stripe/route.ts` - Stripe webhook handler
- `frontend/src/app/api/webhooks/btcpay/route.ts` - BTCPay webhook handler  
- `frontend/src/app/api/create-checkout-session/route.ts` - Checkout session creation
- `frontend/src/app/api/create-btcpay-checkout/route.ts` - BTCPay checkout creation
- `frontend/src/lib/services/subscription-service.ts` - Subscription lifecycle management
- `frontend/src/lib/subscription.ts` - Tier info retrieval
- `frontend/src/components/subscription/PricingPage.tsx` - Payment initiation UI
- `frontend/src/lib/db/schema.ts` - Database schema for subscriptions and payments
- Database migration scripts for subscription and payment tables

**User impact:**
- **CRITICAL** - Users cannot upgrade to Pro tier despite successful payment
- Revenue loss from failed subscription activations
- Poor user experience with no feedback on payment success
- Potential refund requests due to payment but no service delivery
- Affects both Stripe (credit card) and BTCPay (Bitcoin) payment methods

**Business risk:**
- High severity issue blocking the core monetization path
- May affect existing Pro users if subscription renewal webhooks are also failing
- Legal/compliance risk of charging without delivering service
