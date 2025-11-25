## ADDED Requirements

### Requirement: Input Validation for Sensitive Endpoints

The system SHALL validate all input parameters for sensitive endpoints using
schema-based validation before processing.

#### Scenario: UUID validation for secret endpoints

- **GIVEN** a request to reveal a secret server share
- **WHEN** the secret ID parameter is provided
- **THEN** the system SHALL validate the ID is a valid UUID format
- **AND** SHALL reject invalid UUIDs with 400 status and clear error message
- **AND** SHALL validate ownership before any database operations
- **AND** SHALL use timing-safe comparisons to prevent enumeration attacks

#### Scenario: Request body validation

- **GIVEN** a POST request with JSON body
- **WHEN** the request is processed
- **THEN** the system SHALL validate body schema using Zod
- **AND** SHALL reject invalid bodies with 400 status and field-level errors
- **AND** SHALL sanitize all string inputs to prevent injection attacks
- **AND** SHALL enforce maximum payload size limits

#### Scenario: Query parameter validation

- **GIVEN** a request with query parameters
- **WHEN** pagination or filtering is applied
- **THEN** the system SHALL validate parameter types and ranges
- **AND** SHALL reject invalid parameters with 400 status
- **AND** SHALL use default values for missing optional parameters
- **AND** SHALL prevent SQL injection via parameterized queries

### Requirement: Centralized Error Handling

The system SHALL implement consistent error handling across all API endpoints
with standardized error responses.

#### Scenario: APIError class usage

- **GIVEN** an error occurs in an API handler
- **WHEN** the error is an instance of APIError
- **THEN** the system SHALL return the specified status code
- **AND** SHALL include error code and message in response
- **AND** SHALL include detailed context only in development mode
- **AND** SHALL log full error details server-side with request ID

#### Scenario: Unexpected error handling

- **GIVEN** an unexpected error occurs
- **WHEN** the error is not an APIError instance
- **THEN** the system SHALL return 500 status with generic message
- **AND** SHALL log full error details including stack trace
- **AND** SHALL capture error in APM (Sentry) with context
- **AND** SHALL include request ID for correlation

#### Scenario: Validation error responses

- **GIVEN** request validation fails
- **WHEN** validation error is returned
- **THEN** the system SHALL return 400 status
- **AND** SHALL include field-level error details
- **AND** SHALL not expose implementation details
- **AND** SHALL use consistent error response format

### Requirement: Pagination for List Endpoints

The system SHALL implement cursor-based or offset-based pagination for all list
endpoints to prevent performance issues.

#### Scenario: Secrets list pagination

- **GIVEN** a user requests their secrets list
- **WHEN** the request includes pagination parameters
- **THEN** the system SHALL limit results to specified page size (max 100,
  default 50)
- **AND** SHALL return pagination metadata (page, limit, total, totalPages)
- **AND** SHALL order results consistently (by created date descending)
- **AND** SHALL support offset-based pagination with page and limit parameters

#### Scenario: Audit logs pagination

- **GIVEN** a Pro user requests audit logs
- **WHEN** the request includes pagination parameters
- **THEN** the system SHALL paginate results with cursor-based pagination
- **AND** SHALL return next cursor for fetching subsequent pages
- **AND** SHALL efficiently handle large result sets without loading all into
  memory
- **AND** SHALL maintain consistent ordering across pages

#### Scenario: Default pagination behavior

- **GIVEN** a list endpoint is called without pagination parameters
- **WHEN** the system processes the request
- **THEN** the system SHALL apply default pagination (page 1, limit 50)
- **AND** SHALL return pagination metadata in response
- **AND** SHALL not load entire dataset into memory
- **AND** SHALL use database indexes for efficient query execution

## MODIFIED Requirements

### Requirement: Webhook Replay Attack Prevention

The system SHALL prevent replay attacks on payment webhooks using event
deduplication and proper cleanup of old events.

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

#### Scenario: Webhook event retention and cleanup

- **GIVEN** webhook events are stored in the database
- **WHEN** a cleanup job runs
- **THEN** the system SHALL delete webhook events older than 30 days using
  `lt()` operator for date comparison
- **AND** SHALL log the number of events deleted for monitoring
- **AND** SHALL preserve events from the last 30 days for audit and debugging
- **AND** SHALL prevent table bloat from indefinite event accumulation

### Requirement: Rate Limiting

The system SHALL implement comprehensive rate limiting including IP-based limits
to prevent abuse and denial-of-service attacks.

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
  (production) or 5 requests per minute per IP
- **THEN** the system SHALL reject with 429 status

#### Scenario: Rate limit allowlist

- **GIVEN** an IP address is on the allowlist (monitoring, support team)
- **WHEN** requests come from that IP
- **THEN** the system SHALL bypass rate limiting
- **AND** SHALL log the allowlist exemption for audit purposes

### Requirement: CSRF Protection

The system SHALL implement comprehensive Cross-Site Request Forgery (CSRF)
protection with token-based validation for all state-changing API operations.

#### Scenario: CSRF token generation

- **GIVEN** a user authenticates successfully
- **WHEN** the user requests a CSRF token
- **THEN** the system SHALL generate a cryptographically secure random token
- **AND** SHALL store the token in database with session ID and 1-hour
  expiration
- **AND** SHALL return the token to the client for inclusion in subsequent
  requests

#### Scenario: CSRF token validation on state-changing requests

- **GIVEN** a user is authenticated
- **WHEN** the user makes a POST, PUT, PATCH, or DELETE request
- **THEN** the system SHALL validate origin header matches host
- **AND** SHALL validate CSRF token in X-CSRF-Token header
- **AND** SHALL reject requests with null or mismatched origin with 403 status
- **AND** SHALL reject requests with missing or invalid tokens with 403 status
- **AND** SHALL delete token after successful validation (one-time use)
- **AND** SHALL include a clear error message indicating CSRF validation failure

#### Scenario: CSRF token cleanup

- **GIVEN** CSRF tokens are stored in database
- **WHEN** daily cleanup job runs
- **THEN** the system SHALL delete expired tokens (older than 1 hour)
- **AND** SHALL prevent database bloat from unused tokens
- **AND** SHALL log cleanup statistics for monitoring

#### Scenario: CSRF token exemption for machine endpoints

- **GIVEN** a cron job or webhook makes a request
- **WHEN** the request is to an exempted endpoint (/api/cron/_, /api/webhooks/_)
- **THEN** the system SHALL bypass CSRF validation
- **AND** SHALL validate using alternative authentication (CRON_SECRET, webhook
  signatures)

### Requirement: Cron Job Authentication

The system SHALL authenticate cron job requests using request signing and IP
validation with timing-attack resistant verification.

#### Scenario: Valid cron request

- **GIVEN** a cron job makes a request to /api/cron/\* endpoint
- **WHEN** the request includes valid HMAC signature
- **AND** the request timestamp is within 5 minutes of current time
- **AND** the source IP is in the configured whitelist
- **THEN** the system SHALL allow the request to proceed

#### Scenario: HMAC signature verification without timing leaks

- **GIVEN** a cron request includes HMAC signature
- **WHEN** signature is verified
- **THEN** the system SHALL compute expected signature first
- **AND** SHALL validate signature format after computing expected value
- **AND** SHALL use timing-safe comparison for all signature checks
- **AND** SHALL perform dummy comparison for invalid formats to prevent timing
  leaks
- **AND** SHALL reject invalid signatures with 401 status

#### Scenario: Expired cron request

- **GIVEN** a cron job makes a request
- **WHEN** the request timestamp is more than 5 minutes old
- **THEN** the system SHALL reject the request with 401 status
- **AND** SHALL log the replay attempt for security monitoring

#### Scenario: Invalid cron secret

- **GIVEN** a cron job makes a request
- **WHEN** the HMAC signature does not match expected value
- **THEN** the system SHALL reject the request with 401 status
- **AND** SHALL log the authentication failure with source IP
