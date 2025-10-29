# api-security Specification

## Purpose
TBD - created by archiving change harden-production-security. Update Purpose after archive.
## Requirements
### Requirement: CSRF Protection

The system SHALL implement Cross-Site Request Forgery (CSRF) protection for all
state-changing API operations.

#### Scenario: CSRF token validation on state-changing requests

- **GIVEN** a user is authenticated
- **WHEN** the user makes a POST, PUT, or DELETE request
- **THEN** the system SHALL validate the CSRF token in the request
- **AND** SHALL reject requests with missing or invalid tokens with 403 status
- **AND** SHALL include a clear error message indicating CSRF validation failure

#### Scenario: CSRF token exemption for machine endpoints

- **GIVEN** a cron job or webhook makes a request
- **WHEN** the request is to an exempted endpoint (/api/cron/_, /api/webhooks/_)
- **THEN** the system SHALL bypass CSRF validation
- **AND** SHALL validate using alternative authentication (CRON_SECRET, webhook
  signatures)

#### Scenario: CSRF token refresh

- **GIVEN** a user has a long-lived session
- **WHEN** the CSRF token approaches expiration
- **THEN** the system SHALL automatically refresh the token
- **AND** SHALL include the new token in response headers
- **AND** SHALL accept both old and new tokens during transition window

### Requirement: Rate Limiting

The system SHALL implement rate limiting to prevent abuse and denial-of-service
attacks.

#### Scenario: Per-IP rate limiting

- **GIVEN** requests originate from a specific IP address
- **WHEN** more than 100 requests per minute are received from that IP
- **THEN** the system SHALL reject subsequent requests with 429 status
- **AND** SHALL include Retry-After header with seconds until reset
- **AND** SHALL include X-RateLimit-Remaining header showing remaining quota

#### Scenario: Per-user authenticated rate limiting

- **GIVEN** an authenticated user makes requests
- **WHEN** more than 50 requests per minute are received from that user
- **THEN** the system SHALL reject subsequent requests with 429 status
- **AND** SHALL log the user ID and rate limit violation
- **AND** SHALL reset the counter after 60 seconds

#### Scenario: Endpoint-specific rate limits

- **GIVEN** a user makes requests to rate-limited endpoints
- **WHEN** check-in endpoint receives more than 10 requests per hour per user
- **THEN** the system SHALL reject with 429 status
- **WHEN** secret creation endpoint receives more than 5 requests per hour per
  user
- **THEN** the system SHALL reject with 429 status
- **WHEN** OTP request endpoint receives more than 3 requests per hour per email
  (production)
- **THEN** the system SHALL reject with 429 status

#### Scenario: Rate limit allowlist

- **GIVEN** an IP address is on the allowlist (monitoring, support team)
- **WHEN** requests come from that IP
- **THEN** the system SHALL bypass rate limiting
- **AND** SHALL log the allowlist exemption for audit purposes

### Requirement: Webhook Replay Attack Prevention

The system SHALL prevent replay attacks on payment webhooks using event
deduplication.

#### Scenario: First webhook delivery

- **GIVEN** a webhook event is received from Stripe or BTCPay
- **WHEN** the event ID has not been processed before
- **THEN** the system SHALL record the event ID in the database
- **AND** SHALL process the webhook normally
- **AND** SHALL return 200 status

#### Scenario: Duplicate webhook delivery

- **GIVEN** a webhook event is received from Stripe or BTCPay
- **WHEN** the event ID has already been processed
- **THEN** the system SHALL detect the duplicate via database unique constraint
- **AND** SHALL return 200 status without reprocessing
- **AND** SHALL log the replay attempt for security monitoring

#### Scenario: Webhook event retention

- **GIVEN** webhook events are stored in the database
- **WHEN** a cleanup job runs
- **THEN** the system SHALL delete webhook events older than 30 days
- **AND** SHALL preserve events from the last 30 days for audit and debugging

### Requirement: Secure Error Handling

The system SHALL return generic error messages to clients while logging detailed
errors server-side.

#### Scenario: Database error handling

- **GIVEN** a database error occurs during request processing
- **WHEN** the error is returned to the client
- **THEN** the system SHALL return a generic message like "An error occurred"
- **AND** SHALL log the detailed error server-side with request context
- **AND** SHALL not expose database schema, table names, or query details

#### Scenario: Validation error handling

- **GIVEN** request validation fails
- **WHEN** the error is returned to the client
- **THEN** the system SHALL return specific validation failures (field names,
  constraints)
- **AND** SHALL not expose implementation details or internal logic
- **AND** SHALL sanitize any sensitive data from error messages

#### Scenario: Internal server error

- **GIVEN** an unexpected error occurs
- **WHEN** the error is caught by global error handler
- **THEN** the system SHALL return 500 status with generic message
- **AND** SHALL capture full error details in APM (Sentry)
- **AND** SHALL include request ID for correlation

### Requirement: Admin Endpoint Authentication

The system SHALL require strong authentication for administrative endpoints
without fallback values.

#### Scenario: Admin token validation

- **GIVEN** a request is made to an admin endpoint
- **WHEN** the ADMIN_TOKEN environment variable is configured
- **THEN** the system SHALL validate the provided token using constant-time
  comparison
- **AND** SHALL reject requests with invalid tokens with 401 status

#### Scenario: Missing admin token configuration

- **GIVEN** a request is made to an admin endpoint
- **WHEN** the ADMIN_TOKEN environment variable is not set
- **THEN** the system SHALL return 500 status indicating misconfiguration
- **AND** SHALL log a critical error
- **AND** SHALL not use any fallback or default value

#### Scenario: Admin IP whitelist

- **GIVEN** an admin endpoint has IP whitelist configured
- **WHEN** a request comes from a non-whitelisted IP
- **THEN** the system SHALL reject the request with 403 status
- **AND** SHALL log the unauthorized access attempt
- **AND** SHALL include source IP in security logs

### Requirement: Cron Job Authentication

The system SHALL authenticate cron job requests using request signing and IP
validation.

#### Scenario: Valid cron request

- **GIVEN** a cron job makes a request to /api/cron/\* endpoint
- **WHEN** the request includes valid CRON_SECRET using constant-time comparison
- **AND** the request timestamp is within 5 minutes of current time
- **AND** the source IP is in the configured whitelist
- **THEN** the system SHALL allow the request to proceed

#### Scenario: Expired cron request

- **GIVEN** a cron job makes a request
- **WHEN** the request timestamp is more than 5 minutes old
- **THEN** the system SHALL reject the request with 401 status
- **AND** SHALL log the replay attempt for security monitoring

#### Scenario: Invalid cron secret

- **GIVEN** a cron job makes a request
- **WHEN** the CRON_SECRET does not match using constant-time comparison
- **THEN** the system SHALL reject the request with 401 status
- **AND** SHALL log the authentication failure with source IP

