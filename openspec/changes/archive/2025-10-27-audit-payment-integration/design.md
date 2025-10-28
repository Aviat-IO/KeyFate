## Context

KeyFate operates a freemium subscription model with two tiers (Free and Pro). Users can upgrade from Free to Pro by paying via Stripe (credit card) or BTCPay Server (Bitcoin). After a successful payment, the system should:

1. Receive a webhook event from the payment provider
2. Create a record in `user_subscriptions` table linking user to Pro tier
3. Create a record in `payment_history` table for the transaction
4. Update the user's UI to reflect Pro tier status and features

**Current Problem:**
After completing a test payment with Stripe, the UI does not update to show Pro status and database tables remain empty. This indicates a failure in the webhook-to-database-to-UI pipeline.

**Stakeholders:**
- End users expecting immediate access after payment
- Business/revenue team needing accurate subscription tracking
- Support team needing visibility into payment issues

**Constraints:**
- Must support both Stripe and BTCPay Server
- Webhooks must be idempotent (handle duplicate events)
- Database operations must be atomic to prevent partial state
- UI must update within seconds of successful payment
- Must handle test mode and production mode correctly

## Goals / Non-Goals

**Goals:**
- Identify root cause of webhook processing failure
- Fix subscription creation in response to payment webhooks
- Fix payment history recording for all payment events
- Ensure UI updates in real-time after successful payment
- Add comprehensive error logging and admin alerts
- Validate both Stripe and BTCPay integration work end-to-end

**Non-Goals:**
- Implementing subscription plan changes or upgrades (only Pro tier for now)
- Adding new payment providers beyond Stripe and BTCPay
- Implementing trial periods or promotional codes
- Building a comprehensive billing dashboard
- Implementing refund processing (can be manual for now)

## Decisions

### Decision 1: Webhook Processing Architecture

**Choice:** Continue using server-side webhook handlers with direct database writes

**Rationale:**
- Simplest and most reliable approach for subscription lifecycle events
- Stripe and BTCPay both provide robust webhook delivery with retries
- Direct database writes ensure immediate consistency
- No need for message queue complexity at current scale

**Alternatives considered:**
- **Event queue with worker processing:** More scalable but adds complexity and latency
- **Client-side polling:** Unreliable and creates race conditions
- **Server-sent events:** Requires persistent connections and adds complexity

**Implementation:**
- Webhook handlers at `/api/webhooks/stripe` and `/api/webhooks/btcpay`
- Use `subscriptionService.handleStripeWebhook()` and `subscriptionService.handleBTCPayWebhook()`
- Atomic database transactions for subscription + payment record creation
- Return 200 OK only after successful database write

### Decision 2: User ID Propagation Strategy

**Choice:** Pass `user_id` in checkout session metadata and extract from all webhook events

**Rationale:**
- Stripe and BTCPay both support custom metadata on checkout sessions
- Metadata is included in all subsequent webhook events
- Provides reliable user identification without database lookups
- Works in test mode and production mode

**Alternatives considered:**
- **Customer email lookup:** Unreliable if email changes or duplicates exist
- **Session state storage:** Requires session management and expiration handling
- **Database mapping table:** Adds unnecessary indirection

**Implementation:**
- Add `metadata: { user_id: userId }` to all checkout session creation calls
- Extract from `event.data.object.metadata.user_id` in webhook handlers
- Fall back to subscription or customer lookup if metadata missing
- Log warning and send admin alert if `user_id` cannot be resolved

### Decision 3: Database Transaction Strategy

**Choice:** Use database transactions with error rollback for webhook processing

**Rationale:**
- Ensures atomic updates (subscription + payment records created together)
- Prevents partial state if secondary operation fails
- Idempotency: Can safely retry webhook events without duplicates
- Audit logs are created as part of same transaction

**Implementation:**
```typescript
async handleCheckoutSessionCompleted(event, userId) {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    // Create subscription record
    const subscription = await subscriptionService.createSubscription(...)
    
    // Create payment record
    await subscriptionService.createPaymentRecord(...)
    
    // Create audit log
    await logSubscriptionChanged(userId, ...)
  });
}
```

### Decision 4: UI State Refresh Strategy

**Choice:** Optimistic UI update on payment redirect + server-side verification

**Rationale:**
- Provides immediate feedback to user after payment
- Server-side verification ensures accuracy
- Handles webhook delays gracefully
- No need for WebSocket or polling complexity

**Implementation:**
1. After Stripe redirect to `?success=true&session_id=X`, show loading state
2. Client calls `/api/verify-session?session_id=X` to check subscription status
3. Server queries database for `user_subscriptions` record
4. If not found yet, wait 2 seconds and retry (up to 3 times)
5. Once found, refresh page to show Pro UI
6. If never found after retries, show error and contact support message

**Alternatives considered:**
- **Full page refresh:** Works but poor UX
- **Polling:** Wastes resources and adds latency
- **WebSocket:** Overkill for one-time event

### Decision 5: Error Handling and Alerting

**Choice:** Comprehensive logging + admin email alerts for webhook failures

**Rationale:**
- Payment issues are business-critical and need immediate attention
- Stripe provides webhook retry mechanism, but we need visibility
- Users may not report issues immediately
- Prevents revenue loss from silent failures

**Implementation:**
- Log all webhook events with structured logging
- Send admin alert email for:
  - Webhook signature verification failures
  - Missing `user_id` in metadata
  - Database write failures
  - Unexpected event types
- Include event details, error messages, and user ID in alerts
- Track webhook success/failure metrics

### Decision 6: Idempotency Strategy

**Choice:** Check for existing records by `providerSubscriptionId` before creating

**Rationale:**
- Stripe may send duplicate webhook events
- Prevents duplicate subscription or payment records
- Allows safe retry of failed webhook processing

**Implementation:**
```typescript
async createSubscription(data) {
  const existing = await getSubscriptionByProviderSubscriptionId(
    data.provider,
    data.providerSubscriptionId
  );
  
  if (existing) {
    return existing; // Idempotent
  }
  
  return await db.insert(userSubscriptions).values(data);
}
```

## Risks / Trade-offs

### Risk 1: Webhook Delivery Failures
**Scenario:** Stripe webhooks fail to reach our server due to network issues or downtime

**Mitigation:**
- Use Stripe webhook retry mechanism (automatic retries for up to 3 days)
- Implement webhook event replay via Stripe dashboard for manual recovery
- Add manual subscription activation endpoint for support team
- Monitor webhook delivery success rate

### Risk 2: Race Conditions on Rapid Events
**Scenario:** Multiple webhook events arrive simultaneously (e.g., `checkout.session.completed` and `customer.subscription.created`)

**Mitigation:**
- Use database transactions with row-level locking
- Make all webhook handlers idempotent
- Use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` clauses
- Process events by `providerSubscriptionId` to prevent duplicates

### Risk 3: Database Connectivity Issues During Webhook
**Scenario:** Database is temporarily unavailable when webhook is received

**Mitigation:**
- Return 5xx error to trigger Stripe retry
- Add exponential backoff in webhook handler
- Use connection pooling with health checks
- Set reasonable webhook timeout (10 seconds)

### Risk 4: User Metadata Missing from Event
**Scenario:** Older events or edge cases don't include `user_id` in metadata

**Mitigation:**
- Try multiple extraction strategies (metadata, customer email lookup, subscription lookup)
- Log warning and send admin alert for manual resolution
- Return 200 OK but flag for manual review
- Build support tool to link orphaned subscriptions

### Risk 5: BTCPay Integration Differences
**Scenario:** BTCPay webhook event structure differs from Stripe

**Mitigation:**
- Create abstraction layer for payment provider webhooks
- Test BTCPay integration separately with end-to-end tests
- Document BTCPay-specific event handling
- Use BTCPay test mode for validation before production

## Migration Plan

### Phase 1: Diagnosis (Day 1)
1. Enable verbose logging in webhook handlers
2. Trigger test payment and capture logs
3. Check Stripe webhook delivery dashboard
4. Query database to confirm empty tables
5. Document root cause with evidence

### Phase 2: Stripe Integration Fix (Day 1-2)
1. Fix identified issues in Stripe webhook handler
2. Add transaction-based database writes
3. Add idempotency checks
4. Test with Stripe test mode
5. Verify subscription and payment records created

### Phase 3: UI State Refresh (Day 2)
1. Implement session verification endpoint
2. Add optimistic UI update on payment redirect
3. Add loading and error states
4. Test complete flow from payment to UI update

### Phase 4: BTCPay Audit (Day 3)
1. Review BTCPay webhook handler code
2. Test BTCPay checkout flow in test mode
3. Fix any issues found
4. Verify end-to-end Bitcoin payment flow

### Phase 5: Monitoring & Alerts (Day 3-4)
1. Add structured logging for all payment events
2. Set up admin email alerts
3. Create monitoring dashboard
4. Document troubleshooting runbook

### Phase 6: Production Validation (Day 4-5)
1. Deploy fixes to staging
2. Run end-to-end tests for both Stripe and BTCPay
3. Verify with real test payments
4. Deploy to production with monitoring
5. Perform post-deployment smoke test

### Rollback Plan
If issues are found in production:
1. Webhook handlers are read-only from business logic perspective (they write to DB)
2. Can disable webhook endpoints via environment variable
3. Can manually activate subscriptions via admin script
4. Stripe retains webhook events for replay after fix

## Open Questions

1. **Are there any existing Pro users who may have been affected?**
   - Action: Query database for users with secrets > 1 but no subscription record
   - Action: Cross-reference with Stripe customer list

2. **What is the webhook endpoint URL configuration?**
   - Action: Verify webhook URL in Stripe dashboard
   - Action: Confirm URL is publicly accessible (not localhost)
   - Action: Check SSL certificate is valid

3. **Is the webhook endpoint receiving events at all?**
   - Action: Check server access logs for POST requests to `/api/webhooks/stripe`
   - Action: Check application logs for webhook handler execution

4. **Are webhook secrets correctly configured?**
   - Action: Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
   - Action: Verify `BTCPAY_WEBHOOK_SECRET` matches BTCPay configuration

5. **Is the database schema deployed correctly?**
   - Action: Run migration status check
   - Action: Manually verify tables exist with `\d user_subscriptions` in psql

6. **Should we implement a manual subscription activation tool?**
   - Action: Build admin endpoint to manually activate subscriptions
   - Action: Requires user ID, subscription ID, and tier as input
   - Action: Useful for support team to handle edge cases
