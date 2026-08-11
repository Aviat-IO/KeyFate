## MODIFIED Requirements

### Requirement: Stripe Checkout Session Creation

The system SHALL accept a server-defined plan identifier from an authenticated protected POST and SHALL resolve an exact allowlisted Stripe price, product, currency, interval, and mode from server configuration.

#### Scenario: Unsupported price input

- **WHEN** a client supplies a lookup key, price ID, amount, currency, or plan outside the server plan catalog
- **THEN** the system SHALL reject the request before creating any Stripe customer or Checkout Session

#### Scenario: Approved plan

- **WHEN** a client selects an approved plan
- **THEN** the Checkout Session SHALL use the exact configured price and idempotency key
- **AND** metadata SHALL bind the user and plan

#### Scenario: User clicks "Upgrade to Pro" button

- **GIVEN** an authenticated Free-tier user selects the Pro upgrade
- **WHEN** the browser submits the protected plan-selection POST
- **THEN** the server SHALL create an allowlisted Stripe Checkout Session bound to that user and plan
- **AND** the browser SHALL navigate to the returned Stripe checkout URL

#### Scenario: Checkout session includes proper metadata

- **WHEN** the server sends an approved Checkout Session configuration to Stripe
- **THEN** its metadata SHALL bind the canonical user ID and server-defined plan
- **AND** its success and cancel URLs SHALL be server-defined and SHALL NOT authorize entitlement by themselves

### Requirement: Checkout Session Completed Handler

The system SHALL grant entitlement only after retrieving canonical Stripe session/subscription data and validating the configured plan's product, price, currency, interval, mode, livemode, and user binding.

#### Scenario: Unknown or mismatched price

- **WHEN** a signed checkout event refers to a price that is not the configured plan price
- **THEN** the system SHALL NOT grant Pro entitlement
- **AND** SHALL record the event for reconciliation

#### Scenario: Out-of-order events

- **WHEN** subscription and checkout events arrive out of order
- **THEN** the final entitlement SHALL be reconciled from canonical provider state
- **AND** an older event SHALL NOT overwrite newer provider state

#### Scenario: Checkout session completed for new subscription

- **GIVEN** a valid `checkout.session.completed` event references no existing provider subscription record
- **WHEN** canonical Stripe data matches the configured user and plan
- **THEN** the system SHALL atomically create the exact provider-bound entitlement and audit record
- **AND** SHALL derive status and periods from canonical provider data rather than placeholders

#### Scenario: Checkout session completed for existing subscription

- **GIVEN** a valid `checkout.session.completed` event references an existing provider subscription
- **WHEN** canonical Stripe data matches the configured user and plan
- **THEN** the system SHALL reconcile the existing record idempotently
- **AND** SHALL NOT create a duplicate or regress newer provider state

### Requirement: BTCPay Server Checkout Creation

The system SHALL create BTCPay invoices from a server-defined plan amount and accounting currency and SHALL not interpret client-provided amounts or currencies.

#### Scenario: Approved Bitcoin plan

- **WHEN** an authenticated user selects a plan
- **THEN** the server SHALL create an invoice for the exact configured amount and currency
- **AND** metadata SHALL bind `user_id`, plan, interval, and expected amount/currency

#### Scenario: User selects Bitcoin payment option

- **GIVEN** an authenticated user selects a server-defined Bitcoin plan
- **WHEN** the browser submits the protected checkout POST
- **THEN** the server SHALL create a BTCPay invoice using only the canonical plan amount, currency, interval, metadata, notification URL, and redirect URL
- **AND** the browser SHALL navigate to the returned BTCPay checkout URL

### Requirement: BTCPay Webhook Event Handling

The system SHALL verify the webhook signature, map official top-level event metadata, retrieve the full canonical invoice, and validate store, status, amount, currency, plan, interval, and user before granting entitlement.

#### Scenario: Metadata or amount mismatch

- **WHEN** a settled invoice's canonical fields do not match the server plan
- **THEN** the system SHALL NOT grant entitlement
- **AND** SHALL record a reconciliation error without trusting abbreviated webhook fields

#### Scenario: Bitcoin invoice settled

- **GIVEN** a signature-verified settlement event is received
- **WHEN** the retrieved canonical invoice matches the expected store, status, user, plan, interval, amount, and currency
- **THEN** the system SHALL atomically create or reconcile the BTCPay entitlement, payment history, and audit record

#### Scenario: Bitcoin invoice expired

- **GIVEN** a signature-verified expiration event is received
- **WHEN** the canonical invoice confirms it is expired
- **THEN** the system SHALL record the terminal state without granting entitlement
- **AND** MAY notify the bound user

#### Scenario: Bitcoin invoice invalid

- **GIVEN** a signature-verified invalid-invoice event is received
- **WHEN** the canonical invoice confirms it is invalid
- **THEN** the system SHALL record the issue without granting entitlement
- **AND** SHALL alert administrators for reconciliation
