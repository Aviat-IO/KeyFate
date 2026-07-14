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

### Requirement: CSRF Protection

The system SHALL require origin/CSRF protection for unsafe authenticated methods and SHALL prohibit externally visible state changes or third-party object creation from GET, HEAD, or OPTIONS handlers.

#### Scenario: Checkout navigation

- **WHEN** an authenticated browser performs a top-level GET to a checkout route
- **THEN** the system SHALL NOT create a provider customer, session, or invoice
- **AND** checkout creation SHALL require a protected POST

## ADDED Requirements

### Requirement: Enforced Browser Content Policy

The system SHALL emit an enforcing Content-Security-Policy using framework-managed nonces and the minimum external origins required by tested application flows.

#### Scenario: Raw inline script or event handler

- **WHEN** rendered content contains an unapproved inline script or event-handler attribute
- **THEN** the browser policy SHALL block its execution
- **AND** outbound connections SHALL be restricted to the explicit policy
