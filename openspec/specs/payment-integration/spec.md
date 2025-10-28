# payment-integration Specification

## Purpose
TBD - created by archiving change audit-payment-integration. Update Purpose after archive.
## Requirements
### Requirement: Stripe Checkout Session Creation
The system SHALL create a Stripe checkout session with user metadata when a user initiates a Pro upgrade.

#### Scenario: User clicks "Upgrade to Pro" button
- **GIVEN** an authenticated user with Free tier
- **WHEN** the user clicks "Upgrade to Pro" on the pricing page
- **THEN** the system creates a Stripe checkout session with `metadata.user_id` set to the user's ID
- **AND** redirects the user to the Stripe checkout page

#### Scenario: Checkout session includes proper metadata
- **GIVEN** a checkout session is being created
- **WHEN** the session configuration is sent to Stripe
- **THEN** the session includes `metadata: { user_id: <userId> }`
- **AND** the success URL includes `?success=true&session_id={CHECKOUT_SESSION_ID}`
- **AND** the cancel URL includes `?canceled=true`

### Requirement: Stripe Webhook Event Receipt
The system SHALL receive and verify Stripe webhook events for payment and subscription lifecycle events.

#### Scenario: Webhook event is received with valid signature
- **GIVEN** Stripe sends a webhook event to `/api/webhooks/stripe`
- **WHEN** the request includes a valid `stripe-signature` header
- **THEN** the system verifies the signature using `STRIPE_WEBHOOK_SECRET`
- **AND** parses the event payload successfully
- **AND** returns 200 OK to acknowledge receipt

#### Scenario: Webhook event has invalid signature
- **GIVEN** a webhook request is received
- **WHEN** the signature verification fails
- **THEN** the system returns 401 Unauthorized
- **AND** logs the failure with event details
- **AND** sends an admin alert email

#### Scenario: Webhook event missing user_id metadata
- **GIVEN** a webhook event is successfully verified
- **WHEN** the event metadata does not contain `user_id`
- **THEN** the system attempts fallback user extraction from customer or subscription
- **AND** if fallback fails, logs an error and sends admin alert
- **AND** returns 400 Bad Request to prevent Stripe retries

### Requirement: Checkout Session Completed Handler
The system SHALL create a subscription record when a checkout session is completed.

#### Scenario: Checkout session completed for new subscription
- **GIVEN** a `checkout.session.completed` event is received
- **WHEN** the event mode is "subscription" and includes a subscription ID
- **THEN** the system extracts `user_id` from metadata
- **AND** creates a record in `user_subscriptions` with:
  - `userId`: extracted from metadata
  - `tierId`: resolved from "pro" tier name
  - `provider`: "stripe"
  - `providerCustomerId`: Stripe customer ID
  - `providerSubscriptionId`: Stripe subscription ID
  - `status`: "active"
  - `currentPeriodStart`: current timestamp
  - `currentPeriodEnd`: 30 days from now (placeholder until subscription event)
- **AND** creates an audit log entry for subscription creation
- **AND** returns 200 OK

#### Scenario: Checkout session completed for existing subscription
- **GIVEN** a `checkout.session.completed` event is received
- **WHEN** the user already has a subscription record
- **THEN** the system updates the existing subscription status to "active"
- **AND** does not create a duplicate subscription record

### Requirement: Subscription Lifecycle Event Handlers
The system SHALL handle subscription creation, update, and cancellation events from Stripe.

#### Scenario: New subscription created
- **GIVEN** a `customer.subscription.created` event is received
- **WHEN** no subscription exists for the user
- **THEN** the system creates a subscription record with full details from event:
  - Tier extracted from price ID lookup
  - Status from event (typically "active" or "trialing")
  - Period start/end from event timestamps
  - `cancelAtPeriodEnd` flag from event
- **AND** creates an audit log entry

#### Scenario: Subscription updated
- **GIVEN** a `customer.subscription.updated` event is received
- **WHEN** a subscription exists for the user
- **THEN** the system updates the subscription record with:
  - New status (active, past_due, canceled, etc.)
  - Updated period start/end dates
  - Updated `cancelAtPeriodEnd` flag
- **AND** creates an audit log entry

#### Scenario: Subscription deleted
- **GIVEN** a `customer.subscription.deleted` event is received
- **WHEN** a subscription exists for the user
- **THEN** the system updates the subscription status to "cancelled"
- **AND** sends a cancellation confirmation email
- **AND** creates an audit log entry

### Requirement: Payment History Recording
The system SHALL create payment history records for all payment events.

#### Scenario: Payment succeeds
- **GIVEN** an `invoice.payment_succeeded` event is received
- **WHEN** the payment is processed successfully
- **THEN** the system creates a record in `payment_history` with:
  - `userId`: extracted from event metadata
  - `subscriptionId`: user's subscription record ID
  - `provider`: "stripe"
  - `providerPaymentId`: payment intent ID or invoice ID
  - `amount`: invoice amount paid (converted from cents)
  - `currency`: invoice currency (e.g., "USD")
  - `status`: "succeeded"
  - `metadata`: includes invoice ID and subscription ID
- **AND** if subscription was "past_due", updates status to "active"
- **AND** creates an audit log entry

#### Scenario: Payment fails
- **GIVEN** an `invoice.payment_failed` event is received
- **WHEN** a payment attempt fails
- **THEN** the system creates a record in `payment_history` with status "failed"
- **AND** records the failure reason from event
- **AND** updates subscription status to "past_due"
- **AND** sends payment failure notification email
- **AND** if attempt count >= 3, cancels subscription

### Requirement: BTCPay Server Checkout Creation
The system SHALL create a BTCPay Server invoice when a user initiates Bitcoin payment.

#### Scenario: User selects Bitcoin payment option
- **GIVEN** an authenticated user on the pricing page
- **WHEN** the user clicks "Pay with Bitcoin"
- **THEN** the system creates a BTCPay invoice with:
  - Amount and currency (e.g., USD equivalent)
  - `metadata: { user_id, mode: "subscription", tierName: "pro", interval: "month" }`
  - Notification URL pointing to `/api/webhooks/btcpay`
  - Redirect URL for success/cancel
- **AND** redirects user to BTCPay checkout page

### Requirement: BTCPay Webhook Event Handling
The system SHALL handle BTCPay invoice events for Bitcoin payments.

#### Scenario: Bitcoin invoice settled
- **GIVEN** an `InvoiceSettled` event is received from BTCPay
- **WHEN** the invoice metadata indicates subscription mode
- **THEN** the system creates a subscription record with:
  - `provider`: "btcpay"
  - `providerSubscriptionId`: BTCPay invoice ID
  - `providerCustomerId`: null (Bitcoin is anonymous)
  - `status`: "active"
  - Tier and interval from metadata
- **AND** creates a payment history record with Bitcoin amount
- **AND** creates an audit log entry
- **AND** sends subscription confirmation email

#### Scenario: Bitcoin invoice expired
- **GIVEN** an `InvoiceExpired` event is received
- **WHEN** the invoice was not paid in time
- **THEN** the system logs the expiration
- **AND** optionally notifies the user

#### Scenario: Bitcoin invoice invalid
- **GIVEN** an `InvoiceInvalid` event is received
- **WHEN** the invoice is marked invalid by BTCPay
- **THEN** the system logs the issue
- **AND** sends admin alert for investigation

### Requirement: Database Transaction Atomicity
The system SHALL use database transactions to ensure atomic subscription and payment record creation.

#### Scenario: Webhook processing with multiple database writes
- **GIVEN** a webhook event requires creating multiple database records
- **WHEN** the webhook handler processes the event
- **THEN** all database writes occur within a single transaction
- **AND** if any write fails, all writes are rolled back
- **AND** the webhook handler returns 5xx error to trigger retry
- **AND** logs the error with full details

### Requirement: Idempotent Webhook Processing
The system SHALL handle duplicate webhook events idempotently without creating duplicate records.

#### Scenario: Duplicate checkout.session.completed event
- **GIVEN** a `checkout.session.completed` event is received
- **WHEN** a subscription with the same `providerSubscriptionId` already exists
- **THEN** the system returns the existing subscription without creating a duplicate
- **AND** returns 200 OK to acknowledge receipt

#### Scenario: Duplicate invoice.payment_succeeded event
- **GIVEN** an `invoice.payment_succeeded` event is received
- **WHEN** a payment record with the same `providerPaymentId` already exists
- **THEN** the system returns the existing payment record without creating a duplicate
- **AND** returns 200 OK

### Requirement: UI State Synchronization After Payment
The system SHALL update the user interface to reflect Pro tier status immediately after successful payment.

#### Scenario: User redirected after successful checkout
- **GIVEN** user completes payment and is redirected to `/dashboard?success=true&session_id=X`
- **WHEN** the page loads with success parameters
- **THEN** the UI displays a loading state with "Activating your Pro subscription..."
- **AND** calls `/api/verify-session?session_id=X` to check subscription status
- **AND** if subscription is active, shows Pro tier UI features immediately
- **AND** displays success notification "Welcome to KeyFate Pro!"

#### Scenario: Subscription not yet created when user returns
- **GIVEN** user is redirected after payment but webhook hasn't processed yet
- **WHEN** `/api/verify-session` is called and subscription doesn't exist
- **THEN** the system waits 2 seconds and retries (up to 3 times)
- **AND** if subscription is found, returns success
- **AND** if not found after 3 retries, returns pending status
- **AND** UI shows "Activating subscription... This may take a moment"

#### Scenario: Subscription activation fails
- **GIVEN** user completed payment but webhook processing failed
- **WHEN** subscription is not found after maximum retries
- **THEN** UI shows error message with session ID for support reference
- **AND** displays "Contact support@keyfate.com with reference: {session_id}"

### Requirement: Webhook Error Logging and Alerting
The system SHALL log all webhook processing errors and send admin alerts for failures.

#### Scenario: Webhook processing encounters database error
- **GIVEN** a valid webhook event is received
- **WHEN** database write fails during processing
- **THEN** the system logs error with:
  - Event type and ID
  - User ID
  - Error message and stack trace
  - Event payload (sanitized)
- **AND** sends admin alert email with error details
- **AND** returns 500 Internal Server Error to trigger Stripe retry

#### Scenario: Admin alert email is sent
- **GIVEN** a webhook processing failure occurs
- **WHEN** the error handler sends an admin alert
- **THEN** the email includes:
  - Severity level (high for payment failures)
  - Event type and provider (Stripe or BTCPay)
  - User ID if available
  - Error message and stack trace
  - Timestamp
- **AND** email is sent to support@keyfate.com and admin@aviat.io

### Requirement: Subscription Tier Resolution
The system SHALL correctly resolve subscription tier from payment provider price IDs.

#### Scenario: Stripe price ID mapped to Pro tier
- **GIVEN** a subscription event contains a price ID
- **WHEN** the price ID is one of ["price_pro_monthly", "price_pro_yearly", "pro_monthly", "pro_yearly"]
- **THEN** the system resolves the tier name to "pro"
- **AND** queries `subscription_tiers` table for tier record with `name = 'pro'`
- **AND** uses the tier ID for subscription record creation

#### Scenario: Unknown price ID
- **GIVEN** a subscription event contains an unrecognized price ID
- **WHEN** tier resolution is attempted
- **THEN** the system defaults to "free" tier
- **AND** logs a warning with the unknown price ID
- **AND** sends admin alert for manual review

### Requirement: Subscription Tier Seeding
The system SHALL ensure subscription tier records exist in the database before processing payments.

#### Scenario: Pro tier record missing from database
- **GIVEN** a subscription is being created for "pro" tier
- **WHEN** `subscription_tiers` table query for `name = 'pro'` returns no results
- **THEN** the system automatically creates a "pro" tier record with:
  - `name`: "pro"
  - `displayName`: "Pro"
  - `maxSecrets`: 10
  - `maxRecipientsPerSecret`: 5
  - `customIntervals`: true
  - `priceMonthly`: "9.00"
  - `priceYearly`: "90.00"
- **AND** uses the newly created tier for subscription

#### Scenario: Free tier record missing from database
- **GIVEN** a new user is being initialized
- **WHEN** `subscription_tiers` table query for `name = 'free'` returns no results
- **THEN** the system automatically creates a "free" tier record with default limits

### Requirement: Manual Subscription Activation Support Tool
The system SHALL provide an admin endpoint for manual subscription activation in edge cases.

#### Scenario: Support team manually activates subscription
- **GIVEN** a user's payment succeeded but webhook failed
- **WHEN** support team calls `/api/admin/activate-subscription` with:
  - `userId`
  - `providerSubscriptionId`
  - `provider` ("stripe" or "btcpay")
  - `tierName` ("pro")
- **THEN** the system creates a subscription record manually
- **AND** creates a payment history record (if payment ID provided)
- **AND** creates an audit log entry with `action: "manual_activation"`
- **AND** returns success with created subscription details

#### Scenario: Manual activation prevented for existing subscription
- **GIVEN** support team attempts manual activation
- **WHEN** a subscription already exists for the user
- **THEN** the system returns 409 Conflict
- **AND** returns existing subscription details

