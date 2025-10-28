## 1. Discovery & Root Cause Analysis

- [x] 1.1 Check Stripe dashboard for successful payment events (CONFIRMED: Payment succeeded)
- [x] 1.2 Check Stripe webhook delivery logs for event delivery status (FOUND: Webhook fails signature verification)
- [x] 1.3 Verify webhook endpoint is publicly accessible and properly configured (STAGING CONFIRMED)
- [x] 1.4 Check application logs for webhook processing errors (CONFIRMED: 401 Unauthorized)
- [x] 1.5 Verify `STRIPE_WEBHOOK_SECRET` is correctly configured (FOUND: Missing from infrastructure!)
- [x] 1.6 Test webhook signature verification locally (FOUND: Secret not deployed to Cloud Run)
- [x] 1.7 Query database to confirm zero records in `user_subscriptions` and `payment_history` (CONFIRMED)
- [x] 1.8 Review checkout session metadata to ensure `user_id` is passed correctly (CODE CORRECT)
- [x] 1.9 Trace complete flow from checkout button click to webhook event handler (FLOW CORRECT)
- [x] 1.10 Document all identified failure points with file paths and line numbers (DOCUMENTED)

## 2. Stripe Payment Integration Fixes

- [x] 2.1 Fix webhook event handler signature verification (Added STRIPE_WEBHOOK_SECRET to infrastructure)
- [x] 2.2 Metadata extraction verified correct (no fix needed)
- [x] 2.3 `checkout.session.completed` handler verified correct (no fix needed)
- [x] 2.4 `customer.subscription.created` handler verified correct (no fix needed)
- [x] 2.5 `customer.subscription.updated` handler verified correct (no fix needed)
- [x] 2.6 `invoice.payment_succeeded` handler verified correct (no fix needed)
- [x] 2.7 Error handling with admin alerts already implemented (no fix needed)
- [x] 2.8 Retry logic via Stripe automatic retries (sufficient for now)
- [x] 2.9 Admin alert emails already configured (no fix needed)
- [x] 2.10 Tier ID resolution works correctly (no fix needed)

## 3. BTCPay Server Payment Integration Audit

- [ ] 3.1 Audit BTCPay webhook handler (`/api/webhooks/btcpay/route.ts`)
- [ ] 3.2 Verify BTCPay webhook signature verification
- [ ] 3.3 Test `InvoiceSettled` event handler creates subscription
- [ ] 3.4 Test `InvoiceSettled` event handler creates payment record
- [ ] 3.5 Verify BTCPay metadata includes `user_id` correctly
- [ ] 3.6 Add error handling and logging for BTCPay webhook events
- [ ] 3.7 Test BTCPay checkout flow end-to-end in test mode

## 4. Database Schema Verification

- [ ] 4.1 Verify `user_subscriptions` table exists with correct columns
- [ ] 4.2 Verify `payment_history` table exists with correct columns
- [ ] 4.3 Verify `subscription_tiers` table has `pro` and `free` tier records
- [ ] 4.4 Check for any database constraints that might prevent insertions
- [ ] 4.5 Verify foreign key relationships are properly configured
- [ ] 4.6 Add database indexes for performance if missing
- [ ] 4.7 Test subscription creation directly via `subscription-service.ts`

## 5. UI State Synchronization

- [ ] 5.1 Verify dashboard queries `getUserTierInfo()` correctly after payment
- [ ] 5.2 Add real-time tier status refresh after successful payment redirect
- [ ] 5.3 Implement polling or webhook-to-client notification for tier updates
- [ ] 5.4 Update "Upgrade to Pro" button to show "Pro" badge immediately after payment
- [ ] 5.5 Add loading states during payment processing
- [ ] 5.6 Show success notification after subscription activation
- [ ] 5.7 Handle payment success redirect parameters (`?success=true&session_id=...`)
- [ ] 5.8 Add error state UI if subscription activation fails

## 6. End-to-End Testing

- [ ] 6.1 Test Stripe checkout flow with test card in development
- [ ] 6.2 Verify webhook events are received and processed successfully
- [ ] 6.3 Confirm `user_subscriptions` record is created with correct tier
- [ ] 6.4 Confirm `payment_history` record is created
- [ ] 6.5 Verify UI updates to show Pro tier status immediately
- [ ] 6.6 Test subscription renewal webhook handling
- [ ] 6.7 Test subscription cancellation webhook handling
- [ ] 6.8 Test payment failure webhook handling
- [ ] 6.9 Test BTCPay checkout flow with test Bitcoin payment
- [ ] 6.10 Test downgrade scenario (Pro to Free) and verify grandfathering

## 7. Monitoring & Alerting

- [ ] 7.1 Add structured logging for all payment events
- [ ] 7.2 Add metrics tracking for payment success/failure rates
- [ ] 7.3 Set up admin email alerts for webhook failures
- [ ] 7.4 Add dashboard for monitoring subscription creation success rate
- [ ] 7.5 Create runbook for payment integration troubleshooting
- [ ] 7.6 Add automated tests for payment webhook handlers
- [ ] 7.7 Set up Stripe webhook event replay capability for debugging

## 8. Documentation

- [ ] 8.1 Document complete payment flow architecture
- [ ] 8.2 Document webhook event handling for each payment provider
- [ ] 8.3 Document database schema for subscriptions and payments
- [ ] 8.4 Document UI state management for tier status
- [ ] 8.5 Create troubleshooting guide for payment issues
- [ ] 8.6 Document test payment procedures for both Stripe and BTCPay
