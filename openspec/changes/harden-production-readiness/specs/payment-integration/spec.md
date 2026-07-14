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

### Requirement: BTCPay Server Checkout Creation

The system SHALL create BTCPay invoices from a server-defined plan amount and accounting currency and SHALL not interpret client-provided amounts or currencies.

#### Scenario: Approved Bitcoin plan

- **WHEN** an authenticated user selects a plan
- **THEN** the server SHALL create an invoice for the exact configured amount and currency
- **AND** metadata SHALL bind `user_id`, plan, interval, and expected amount/currency

### Requirement: BTCPay Webhook Event Handling

The system SHALL verify the webhook signature, map official top-level event metadata, retrieve the full canonical invoice, and validate store, status, amount, currency, plan, interval, and user before granting entitlement.

#### Scenario: Metadata or amount mismatch

- **WHEN** a settled invoice's canonical fields do not match the server plan
- **THEN** the system SHALL NOT grant entitlement
- **AND** SHALL record a reconciliation error without trusting abbreviated webhook fields
