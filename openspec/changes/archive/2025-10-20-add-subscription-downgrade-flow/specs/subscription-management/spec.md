# Subscription Management Specification

## ADDED Requirements

### Requirement: Subscription Management Page
The system SHALL provide a subscription management page at `/settings/subscription` where users can view their current plan and manage upgrades/downgrades.

#### Scenario: Free user views subscription page
- **WHEN** a Free user navigates to `/settings/subscription`
- **THEN** the system displays their current tier as "Free"
- **AND** displays an "Upgrade to Pro" button that links to `/pricing`
- **AND** displays Free tier limits (1 secret, 1 recipient, limited intervals)

#### Scenario: Pro user views subscription page
- **WHEN** a Pro user navigates to `/settings/subscription`
- **THEN** the system displays their current tier as "Pro"
- **AND** displays subscription status (active, past_due, etc.)
- **AND** displays current billing period dates (start and end)
- **AND** displays a "Downgrade to Free" button

#### Scenario: Pro user with scheduled downgrade views page
- **WHEN** a Pro user with a scheduled downgrade navigates to `/settings/subscription`
- **THEN** the system displays "Downgrade scheduled for [date]" message
- **AND** displays a "Cancel Downgrade" button
- **AND** does NOT display the "Downgrade to Free" button

### Requirement: Schedule Downgrade
The system SHALL allow Pro users to schedule a downgrade to Free tier at the end of their current billing period.

#### Scenario: Pro user schedules downgrade
- **WHEN** a Pro user clicks "Downgrade to Free"
- **THEN** the system displays a confirmation dialog explaining the downgrade will occur at period end
- **WHEN** the user confirms the downgrade
- **THEN** the system sets `scheduled_downgrade_at` to `currentPeriodEnd`
- **AND** updates Stripe subscription with `cancel_at_period_end = true` (if Stripe)
- **AND** sends confirmation message: "Downgrade scheduled for [date]. You'll keep Pro features until then."
- **AND** logs audit event: `subscription_changed` (action: "downgrade_scheduled")

#### Scenario: Pro user schedules downgrade with BTCPay
- **WHEN** a Pro user with BTCPay subscription schedules downgrade
- **THEN** the system calculates period end from payment date + subscription duration
- **AND** sets `scheduled_downgrade_at` to calculated period end
- **AND** sends confirmation message with calculated downgrade date

#### Scenario: User already has scheduled downgrade
- **WHEN** a Pro user with scheduled downgrade clicks "Downgrade to Free" again
- **THEN** the system displays message: "Downgrade already scheduled for [date]"
- **AND** does NOT create duplicate scheduling

### Requirement: Cancel Scheduled Downgrade
The system SHALL allow users to cancel a scheduled downgrade before it takes effect.

#### Scenario: User cancels scheduled downgrade
- **WHEN** a Pro user with scheduled downgrade clicks "Cancel Downgrade"
- **THEN** the system displays confirmation dialog
- **WHEN** the user confirms cancellation
- **THEN** the system clears `scheduled_downgrade_at` field
- **AND** updates Stripe subscription with `cancel_at_period_end = false` (if Stripe)
- **AND** sends confirmation message: "Downgrade cancelled. Your Pro subscription will continue."
- **AND** logs audit event: `subscription_changed` (action: "downgrade_cancelled")

#### Scenario: Cancel downgrade after period end
- **WHEN** a user attempts to cancel downgrade after `currentPeriodEnd` has passed
- **THEN** the system displays error: "Cannot cancel - subscription has already ended"
- **AND** does NOT modify subscription

### Requirement: Process Scheduled Downgrades
The system SHALL automatically process scheduled downgrades via a daily cron job.

#### Scenario: Cron job processes eligible downgrades
- **WHEN** the cron job runs at 00:00 UTC daily
- **THEN** the system queries subscriptions WHERE `scheduled_downgrade_at <= NOW()` AND `status = 'active'`
- **AND** for each eligible subscription:
  - Updates `tierId` to Free tier
  - Sets `status` to 'cancelled'
  - Clears `scheduled_downgrade_at`
  - Sends email: "Your Pro subscription has ended. You're now on the Free plan."
  - Logs audit event: `subscription_changed` (action: "downgrade_executed", from: "pro", to: "free")

#### Scenario: Cron job with no eligible downgrades
- **WHEN** the cron job runs and no subscriptions have `scheduled_downgrade_at <= NOW()`
- **THEN** the system logs: "No downgrades to process"
- **AND** completes successfully with count: 0

#### Scenario: Cron job authentication
- **WHEN** the cron endpoint `/api/cron/process-subscription-downgrades` is called
- **THEN** the system verifies `Authorization: Bearer [CRON_SECRET]` header
- **WHEN** authentication fails
- **THEN** the system returns 401 Unauthorized

#### Scenario: Downgrade execution with errors
- **WHEN** the cron job encounters an error processing a specific subscription
- **THEN** the system logs the error with subscription ID
- **AND** continues processing remaining subscriptions
- **AND** returns summary: processed count, failed count, errors list

### Requirement: Downgrade Impact on User Features
The system SHALL handle feature access changes when a user downgrades from Pro to Free.

#### Scenario: Downgraded user with grandfathered secrets
- **WHEN** a user downgrades from Pro to Free
- **AND** the user has more than 1 active secret (Free limit)
- **THEN** the system allows all existing secrets to remain active (grandfathered)
- **AND** prevents creation of new secrets until count <= Free tier limit
- **AND** displays message: "You have X secrets (limit: 1). Remove secrets to create new ones."

#### Scenario: Downgraded user loses Pro features
- **WHEN** a user's downgrade is executed (tier changes to Free)
- **THEN** the system removes access to: custom check-in intervals, configurable thresholds, message templates, audit logs
- **AND** existing secrets retain their Pro-configured settings (intervals, thresholds) until edited

### Requirement: Database Schema for Downgrade Scheduling
The system SHALL support downgrade scheduling through database schema changes.

#### Scenario: Store scheduled downgrade timestamp
- **WHEN** a user schedules a downgrade
- **THEN** the system stores `scheduled_downgrade_at` timestamp in `user_subscriptions` table
- **AND** the timestamp reflects the user's `currentPeriodEnd` value

#### Scenario: Query for processable downgrades
- **WHEN** the cron job needs to find downgrades to process
- **THEN** the system efficiently queries using index on `scheduled_downgrade_at` column
- **AND** filters for non-null `scheduled_downgrade_at` values <= current timestamp

### Requirement: Test Coverage for Downgrade Functionality
The system SHALL have comprehensive automated tests following test-driven development practices.

#### Scenario: Unit tests for subscription service methods
- **WHEN** implementing `scheduleDowngrade()` and `cancelScheduledDowngrade()` methods
- **THEN** the system has unit tests covering success cases, error cases, and edge cases
- **AND** tests are written before implementation (TDD approach)
- **AND** tests achieve >90% code coverage for the subscription service layer

#### Scenario: Integration tests for complete downgrade flows
- **WHEN** implementing the downgrade feature
- **THEN** the system has integration tests covering end-to-end Stripe and BTCPay flows
- **AND** tests verify schedule → execute → email → audit log chain
- **AND** tests verify cancellation prevents downgrade execution

#### Scenario: Component tests for Settings UI
- **WHEN** implementing Settings pages and downgrade UI
- **THEN** the system has component tests for all UI states (Free, Pro, scheduled downgrade)
- **AND** tests verify user interactions trigger correct API calls
- **AND** tests verify conditional rendering based on subscription state

#### Scenario: Cron job tests
- **WHEN** implementing the downgrade processing cron job
- **THEN** the system has tests for authentication, query logic, and processing logic
- **AND** tests verify error handling for partial failures
- **AND** tests verify email and audit log creation
