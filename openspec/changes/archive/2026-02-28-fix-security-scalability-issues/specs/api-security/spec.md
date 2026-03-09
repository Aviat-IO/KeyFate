# api-security Spec Delta

## MODIFIED Requirements

### Requirement: Rate Limiting

The system SHALL implement distributed rate limiting using PostgreSQL to work
correctly across multiple Cloud Run instances.

#### Scenario: Distributed rate limiting across instances

- **GIVEN** multiple Cloud Run instances are running
- **WHEN** a user makes requests distributed across different instances
- **THEN** the system SHALL track rate limits in PostgreSQL database
- **AND** SHALL enforce cumulative limits across all instances
- **AND** SHALL reject requests when total across instances exceeds limit
- **AND** SHALL use atomic operations to prevent race conditions

#### Scenario: Rate limit storage with TTL

- **GIVEN** rate limit entries are stored in database
- **WHEN** a rate limit window expires
- **THEN** the system SHALL automatically expire entries using timestamp-based
  filtering
- **AND** SHALL periodically cleanup expired entries to prevent table growth
- **AND** SHALL use unlogged tables for better write performance

#### Scenario: Rate limit performance

- **GIVEN** a rate limit check is performed
- **WHEN** the check queries the database
- **THEN** the system SHALL complete within 5 milliseconds (p95)
- **AND** SHALL use indexes for efficient queries
- **AND** SHALL use `INSERT ... ON CONFLICT` for atomic increment

#### Scenario: Rate limit fallback on database failure

- **GIVEN** the database is unavailable
- **WHEN** a rate limit check is attempted
- **THEN** the system SHALL fail open (allow request) to prevent service
  disruption
- **AND** SHALL log the database failure
- **AND** SHALL alert operations team

### Requirement: Webhook Replay Attack Prevention

The system SHALL prevent replay attacks on payment webhooks using strict
timestamp validation and event deduplication.

#### Scenario: Webhook timestamp validation

- **GIVEN** a webhook is received
- **WHEN** the webhook timestamp is validated
- **THEN** the system SHALL reject webhooks older than 2 minutes
- **AND** SHALL reject webhooks with future timestamps
- **AND** SHALL log replay attempts for security monitoring

#### Scenario: Webhook deduplication with TTL

- **GIVEN** webhook events are stored for deduplication
- **WHEN** checking for duplicates
- **THEN** the system SHALL only check events from last 24 hours
- **AND** SHALL use indexed query on provider and event_id
- **AND** SHALL cleanup events older than 30 days

### Requirement: Cron Job Distributed Locking

The system SHALL use PostgreSQL advisory locks to prevent concurrent cron job
execution across multiple instances.

#### Scenario: Advisory lock acquisition

- **GIVEN** a cron job needs to process a secret
- **WHEN** acquiring lock for the secret
- **THEN** the system SHALL use `pg_try_advisory_lock()` with secret ID hash
- **AND** SHALL skip secret if lock cannot be acquired
- **AND** SHALL release lock when processing completes
- **AND** SHALL automatically release lock if connection drops

#### Scenario: Lock timeout handling

- **GIVEN** a cron job holds a lock
- **WHEN** processing takes longer than 30 seconds
- **THEN** the system SHALL log warning about long lock duration
- **AND** SHALL continue processing (locks auto-released on connection close)

## ADDED Requirements

### Requirement: CSRF Token One-Time Use

The system SHALL implement one-time CSRF tokens that are invalidated after use.

#### Scenario: Token deletion on validation

- **GIVEN** a CSRF token is validated
- **WHEN** the token is checked and found valid
- **THEN** the system SHALL delete the token from database in same transaction
- **AND** SHALL return 403 if token is reused
- **AND** SHALL generate new token for response

#### Scenario: Token expiration

- **GIVEN** CSRF tokens are stored in database
- **WHEN** a token is older than 5 minutes
- **THEN** the system SHALL reject the token
- **AND** SHALL periodically cleanup expired tokens
- **AND** SHALL return clear error message to retry

### Requirement: Cron Job State Persistence

The system SHALL persist cron job state to handle timeouts gracefully.

#### Scenario: State persistence on timeout

- **GIVEN** a cron job is processing secrets
- **WHEN** approaching timeout (8:30 of 9:00 limit)
- **THEN** the system SHALL save last processed secret ID to database
- **AND** SHALL save processed count and timestamp
- **AND** SHALL exit gracefully with partial success response

#### Scenario: State resumption

- **GIVEN** a cron job has saved state from previous run
- **WHEN** the next cron execution starts
- **THEN** the system SHALL query for state with matching job name
- **AND** SHALL resume processing from last processed ID
- **AND** SHALL use cursor-based pagination (WHERE id > last_id)
- **AND** SHALL clear state when all work complete

#### Scenario: Stale state handling

- **GIVEN** cron job state exists from previous run
- **WHEN** state is older than 1 hour
- **THEN** the system SHALL ignore stale state and start fresh
- **AND** SHALL log warning about stale state
- **AND** SHALL delete stale state records
