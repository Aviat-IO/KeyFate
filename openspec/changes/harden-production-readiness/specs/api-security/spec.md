## MODIFIED Requirements

### Requirement: Rate Limiting

The system SHALL implement shared PostgreSQL-backed rate limiting using one atomic reset-or-increment decision and SHALL deny protected actions when the limiter cannot determine authorization.

#### Scenario: Concurrent requests

- **GIVEN** multiple replicas receive concurrent requests for the same limit key and window
- **WHEN** the limit is incremented
- **THEN** every authorized request SHALL be reflected in the committed count
- **AND** no request SHALL be admitted from a stale read-modify-write decision

#### Scenario: Rate-limit storage unavailable

- **WHEN** PostgreSQL cannot complete the rate-limit decision
- **THEN** the protected operation SHALL fail closed with a retryable unavailable response
- **AND** SHALL NOT continue as authorized

#### Scenario: Per-IP rate limiting

- **GIVEN** requests originate from a specific IP address
- **WHEN** more than the configured requests per window are received from that IP
- **THEN** the system SHALL reject subsequent requests with 429 status
- **AND** SHALL include Retry-After and remaining-quota response headers

#### Scenario: Per-user authenticated rate limiting

- **GIVEN** an authenticated user makes requests
- **WHEN** the configured per-user limit is exceeded
- **THEN** the system SHALL reject subsequent requests with 429 status
- **AND** SHALL log the user ID and violation
- **AND** SHALL reset the committed counter after its configured window

#### Scenario: Endpoint-specific rate limits

- **WHEN** check-in, secret creation, OTP, or another protected endpoint is called
- **THEN** the system SHALL apply that endpoint's configured limit and identity key atomically
- **AND** SHALL reject requests above the configured limit with 429 status

#### Scenario: Rate limit allowlist

- **GIVEN** an IP address is explicitly allowlisted for monitoring or support
- **WHEN** requests come from that IP
- **THEN** the system MAY bypass rate limiting
- **AND** SHALL log the allowlist exemption for audit purposes

### Requirement: CSRF Protection

The system SHALL require origin/CSRF protection for unsafe authenticated methods and SHALL prohibit externally visible state changes or third-party object creation from GET, HEAD, or OPTIONS handlers.

#### Scenario: Checkout navigation

- **WHEN** an authenticated browser performs a top-level GET to a checkout route
- **THEN** the system SHALL NOT create a provider customer, session, or invoice
- **AND** checkout creation SHALL require a protected POST

#### Scenario: CSRF token validation on state-changing requests

- **GIVEN** a user is authenticated
- **WHEN** the user makes an unsafe state-changing request
- **THEN** the system SHALL validate its origin and CSRF token
- **AND** SHALL reject missing or invalid protection with 403 status and a clear error

#### Scenario: CSRF token exemption for machine endpoints

- **GIVEN** a cron job or webhook calls an explicitly exempted machine endpoint
- **WHEN** browser CSRF validation is bypassed
- **THEN** the endpoint SHALL validate its purpose-specific cron secret or provider signature
- **AND** SHALL NOT rely on ambient browser authentication

#### Scenario: CSRF token refresh

- **GIVEN** a user has a long-lived session
- **WHEN** the CSRF token approaches expiration
- **THEN** the system SHALL refresh it without disabling validation
- **AND** SHALL support the bounded transition required by the client

## ADDED Requirements

### Requirement: Enforced Browser Content Policy

The system SHALL emit an enforcing Content-Security-Policy using framework-managed nonces and the minimum external origins required by tested application flows.

#### Scenario: Raw inline script or event handler

- **WHEN** rendered content contains an unapproved inline script or event-handler attribute
- **THEN** the browser policy SHALL block its execution
- **AND** outbound connections SHALL be restricted to the explicit policy
