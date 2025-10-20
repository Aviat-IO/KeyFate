# Design: Subscription Downgrade Flow

## Context

Users currently have no self-service way to downgrade from Pro to Free tier. They must either contact support or navigate external payment portals (Stripe/BTCPay). We need a unified, in-app downgrade experience that works with both payment providers while respecting billing cycles and maintaining data integrity.

## Goals / Non-Goals

**Goals:**

- Enable Pro users to self-service downgrade to Free tier
- Honor billing cycles (downgrade at period end, not immediately)
- Support both Stripe and BTCPay Server workflows
- Maintain data integrity (existing secrets remain, grandfathered)
- Provide clear UI feedback about downgrade status and timing
- Follow test-driven development (TDD) best practices throughout implementation
- Achieve comprehensive test coverage for all downgrade flows

**Non-Goals:**

- Immediate downgrades (always honor billing period)
- Partial refunds or prorated billing adjustments
- Downgrade to tiers other than Free (only Pro → Free)
- Migration or deletion of existing Pro-tier secrets

## Decisions

### Settings UI Architecture

Use ShadCN sidebar component for navigation within `/settings` section. Structure:

- `/settings` → redirects to `/settings/general` (default)
- `/settings/general` → user profile info (name, email, join date)
- `/settings/audit` → audit logs (Pro users only)
- `/settings/subscription` → subscription management

**Rationale:** Sidebar pattern is familiar, scales well for future settings pages, and provides clear context about current location.

### Downgrade Timing

Downgrades take effect at `currentPeriodEnd`, not immediately:

- **Stripe:** Use built-in `cancel_at_period_end` flag
- **BTCPay:** Store `scheduled_downgrade_at` timestamp (calculated from payment date + interval)

**Rationale:** Users have paid for the full period and should retain access. Immediate downgrade would feel like losing purchased value.

### Cron Job Design

Daily cron job (`/api/cron/process-subscription-downgrades`) checks for expired subscriptions:

1. Query: `scheduled_downgrade_at <= NOW() AND status = 'active'`
2. For each: update tier to Free, send email, log audit event
3. Run daily at 00:00 UTC

**Rationale:** Daily cadence is sufficient (not time-critical), reduces load, and aligns with existing cron patterns.

### Data Model Changes

Add `scheduled_downgrade_at` timestamp to `user_subscriptions`:

```sql
ALTER TABLE user_subscriptions 
ADD COLUMN scheduled_downgrade_at TIMESTAMP;
```

**Rationale:**

- Explicit scheduling field decouples downgrade intent from execution
- Supports "cancel downgrade" feature (clear field to cancel)
- Works uniformly for both Stripe and BTCPay

### Payment Provider Integration

**Stripe:**

- Schedule downgrade: call `stripe.subscriptions.update(id, { cancel_at_period_end: true })`
- Cancel downgrade: call `stripe.subscriptions.update(id, { cancel_at_period_end: false })`
- Cron job: verify Stripe status matches before downgrading

**BTCPay:**

- BTCPay doesn't have native subscriptions; payment is one-time
- Calculate period end: `payment_date + subscription_duration`
- Store as `scheduled_downgrade_at` when user clicks downgrade
- Cron job handles actual tier change

### User Flow

**Schedule Downgrade:**

1. User clicks "Downgrade to Free" on `/settings/subscription`
2. Confirmation dialog explains: keeps Pro until [period end date], then downgrades
3. API call: `POST /api/user/subscription/schedule-downgrade`
4. Update: set `scheduled_downgrade_at = currentPeriodEnd`, update Stripe if applicable
5. UI shows: "Downgrade scheduled for [date]" with "Cancel downgrade" button

**Cancel Downgrade:**

1. User clicks "Cancel downgrade"
2. API call: `POST /api/user/subscription/cancel-downgrade`
3. Update: clear `scheduled_downgrade_at`, clear Stripe `cancel_at_period_end`
4. UI shows: normal Pro subscription state

**Execute Downgrade (Cron):**

1. Daily cron finds subscriptions with `scheduled_downgrade_at <= NOW()`
2. Update `tierId` to Free tier, set `status = 'cancelled'`
3. Send email: "Your subscription has ended. You're now on the Free plan."
4. Log audit event: `subscription_changed` (Pro → Free)

## Risks / Trade-offs

**Risk:** Cron job fails, users stuck on Pro tier after payment ends

- **Mitigation:** Add monitoring/alerting for cron failures, manual admin override capability

**Risk:** User confusion about "why am I still Pro after clicking downgrade?"

- **Mitigation:** Clear messaging in UI: "You'll remain Pro until [date]"

**Risk:** BTCPay period calculation incorrect (no native subscription concept)

- **Mitigation:** Store `currentPeriodEnd` at payment time, use that for downgrade scheduling

**Trade-off:** Daily cron vs. scheduled per-subscription jobs

- **Chosen:** Daily cron (simpler, single job to monitor)
- **Alternative:** Google Cloud Tasks per-subscription (more precise timing, but complex)

## Test-Driven Development Approach

This feature will be implemented following strict TDD practices:

### Unit Testing Strategy

**Subscription Service Layer:**
- Test `scheduleDowngrade()` for both Stripe and BTCPay providers
- Test `cancelScheduledDowngrade()` with various subscription states
- Test edge cases: already scheduled, expired subscription, invalid tier transitions
- Mock database calls and external API interactions

**Payment Provider Layer:**
- Test Stripe `cancel_at_period_end` flag handling in isolation
- Test BTCPay period end calculation logic
- Test webhook event processing for cancellations
- Mock Stripe SDK and BTCPay API calls

**API Endpoint Layer:**
- Test authentication/authorization for both endpoints
- Test request validation and error responses
- Test success scenarios with mocked service layer
- Test edge cases: unauthorized access, missing subscription, invalid state transitions

**Cron Job Layer:**
- Test CRON_SECRET authentication (valid/invalid tokens)
- Test query logic for eligible subscriptions
- Test processing logic with mocked database
- Test error handling for partial failures
- Test email sending and audit logging

### Integration Testing Strategy

**End-to-End Flows:**
- Test complete Stripe downgrade flow: schedule → wait → cron execution → email
- Test complete BTCPay downgrade flow with period calculation
- Test cancellation flow: schedule → cancel → verify no downgrade occurs
- Test grandfathering behavior: downgrade with >1 secret, verify existing secrets remain

**Database Integration:**
- Test schema migration applies cleanly
- Test queries perform efficiently with indexed columns
- Test transaction handling for downgrade execution

**UI Component Testing:**
- Test Settings layout and sidebar navigation rendering
- Test conditional display logic (Free vs Pro vs scheduled downgrade states)
- Test user interactions: button clicks, dialog confirmations
- Test routing and redirects

### Test Coverage Goals

- **Unit tests:** >90% coverage for service layer, API endpoints, cron job logic
- **Integration tests:** Cover all critical user paths (schedule, cancel, execute)
- **Component tests:** Cover all UI states and user interactions
- **E2E tests:** At least one happy path for each provider (Stripe, BTCPay)

### TDD Workflow

Each implementation phase follows:
1. **Write failing tests** that define expected behavior
2. **Run tests** to verify they fail for the right reasons
3. **Implement minimum code** to make tests pass
4. **Refactor** while keeping tests green
5. **Verify** all tests pass before moving to next phase

## Migration Plan

1. **Database migration:** Add `scheduled_downgrade_at` column (nullable)
2. **TDD Phase 1:** Write and pass all unit tests for subscription service layer
3. **TDD Phase 2:** Write and pass all unit tests for payment providers
4. **TDD Phase 3:** Write and pass all unit tests for API endpoints
5. **TDD Phase 4:** Write and pass all unit tests for cron job
6. **TDD Phase 5:** Write and pass all component tests for UI
7. **Integration testing:** Verify end-to-end flows work correctly
8. **Deploy backend changes:** API endpoints, subscription service, cron job
9. **Deploy frontend changes:** Settings UI, navbar updates
10. **Configure Cloud Scheduler:** Add daily cron job for downgrade processing
11. **Monitor:** Watch logs for first few executions, verify emails sent, verify test coverage reports

**Rollback:**

- Revert frontend (settings UI removed, old nav restored)
- Disable cron job in Cloud Scheduler
- Revert backend API changes
- Database column can remain (nullable, unused is safe)

## Open Questions

- Should we allow downgrade scheduling for users with `cancel_at_period_end` already set? **Decision:** Yes, treat as re-confirmation.
- Should Pro users who downgrade be offered a "survey" to capture feedback? **Decision:** Out of scope, add in future iteration.
