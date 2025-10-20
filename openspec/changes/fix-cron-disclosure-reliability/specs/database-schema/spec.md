# Database Schema

## MODIFIED Requirements

### Requirement: Secrets Table Schema

The secrets table SHALL store user secrets with encryption metadata, status
tracking, retry logic, and processing state.

#### Scenario: Secret record includes retry tracking

- **GIVEN** a secret is created
- **WHEN** the secret fails disclosure
- **THEN** retry_count is incremented (default 0, max 5)
- **AND** last_retry_at is set to current timestamp
- **AND** retry_count and last_retry_at columns exist with correct types

#### Scenario: Secret record includes processing state

- **GIVEN** a secret is being processed by cron job
- **WHEN** optimistic locking succeeds
- **THEN** processing_started_at is set to current timestamp
- **AND** when processing completes, processing_started_at is cleared to NULL

#### Scenario: Secret status transitions

- **GIVEN** a secret exists
- **WHEN** disclosure is attempted
- **THEN** status can be 'active', 'paused', 'triggered', or 'failed'
- **AND** status='failed' is set after retry_count exceeds 5

### Requirement: Disclosure Log Unique Constraint

The disclosure_log table SHALL enforce a unique constraint on (secret_id,
recipient_email) WHERE status='sent' to prevent duplicate disclosures.

#### Scenario: Duplicate sent disclosure is prevented

- **GIVEN** a disclosure_log entry exists with secret_id=123,
  recipient_email='test@example.com', status='sent'
- **WHEN** an INSERT attempts to create another entry with same secret_id,
  recipient_email, and status='sent'
- **THEN** the INSERT fails with unique constraint violation
- **AND** no duplicate row is created

#### Scenario: Multiple pending disclosures allowed

- **GIVEN** a disclosure_log entry exists with secret_id=123,
  recipient_email='test@example.com', status='pending'
- **WHEN** an INSERT creates another entry with same secret_id, recipient_email,
  and status='pending'
- **THEN** the INSERT succeeds (partial index allows non-sent duplicates)
- **AND** both rows exist in database

#### Scenario: Sent and failed disclosures can coexist

- **GIVEN** a disclosure_log entry exists with secret_id=123,
  recipient_email='test@example.com', status='sent'
- **WHEN** an INSERT creates another entry with same secret_id, recipient_email,
  and status='failed'
- **THEN** the INSERT succeeds (different status values)
- **AND** both rows exist in database

### Requirement: Disclosure Log Batch Query Index

The disclosure_log table SHALL have an index on (secret_id, recipient_email,
status, created_at) to optimize batch fetching of existing disclosures.

#### Scenario: Batch query uses index for performance

- **GIVEN** 1000 disclosure_log entries exist
- **WHEN** a query fetches all sent disclosures for secret_id=123 with
  recipient_email IN (50 emails)
- **THEN** the query uses idx_disclosure_log_batch_fetch index
- **AND** query execution time is < 10ms
- **AND** no full table scan occurs

#### Scenario: Index covers common query patterns

- **GIVEN** the idx_disclosure_log_batch_fetch index exists
- **WHEN** queries filter by secret_id + recipient_email + status
- **THEN** the index is used (covering index)
- **AND** PostgreSQL does not require additional lookups

## ADDED Requirements

### Requirement: Secret Retry Limit Columns

The secrets table SHALL include retry_count and last_retry_at columns to track
failed disclosure attempts.

#### Scenario: New secret has zero retry count

- **GIVEN** a user creates a new secret
- **WHEN** the secret is inserted into database
- **THEN** retry_count defaults to 0
- **AND** last_retry_at is NULL

#### Scenario: Failed disclosure increments retry count

- **GIVEN** a secret with retry_count=2
- **WHEN** disclosure fails and cron job updates the secret
- **THEN** retry_count is incremented to 3
- **AND** last_retry_at is set to current timestamp
- **AND** status remains 'active' if retry_count < 5

#### Scenario: Max retries sets failed status

- **GIVEN** a secret with retry_count=5
- **WHEN** disclosure fails again
- **THEN** retry_count is incremented to 6
- **AND** status is set to 'failed'
- **AND** last_retry_at is set to current timestamp
- **AND** future cron runs skip this secret

### Requirement: Database Migration for Schema Changes

The system SHALL provide a database migration to add retry columns, unique
constraint, and performance indexes.

#### Scenario: Migration adds retry columns

- **GIVEN** existing secrets table without retry_count
- **WHEN** migration is applied
- **THEN** retry_count column is added with DEFAULT 0 NOT NULL
- **AND** last_retry_at column is added (nullable)
- **AND** all existing secrets have retry_count=0

#### Scenario: Migration adds unique constraint

- **GIVEN** existing disclosure_log table
- **WHEN** migration is applied
- **THEN** unique partial index idx_disclosure_log_unique is created
- **AND** constraint enforces uniqueness on (secret_id, recipient_email) WHERE
  status='sent'

#### Scenario: Migration adds batch query index

- **GIVEN** existing disclosure_log table
- **WHEN** migration is applied
- **THEN** index idx_disclosure_log_batch_fetch is created
- **AND** index covers (secret_id, recipient_email, status, created_at)

#### Scenario: Migration handles existing duplicates

- **GIVEN** disclosure_log has duplicate sent entries for same secret+recipient
- **WHEN** migration pre-cleanup script runs
- **THEN** oldest duplicate entries are deleted (keep newest)
- **AND** only one sent entry remains per secret+recipient pair
- **AND** unique constraint can be applied successfully

### Requirement: Migration Rollback Support

The system SHALL support rollback of schema changes if critical issues are
detected after deployment.

#### Scenario: Rollback removes new columns

- **GIVEN** migration has been applied with retry columns
- **WHEN** rollback migration is executed
- **THEN** retry_count column is dropped from secrets table
- **AND** last_retry_at column is dropped from secrets table

#### Scenario: Rollback removes indexes and constraints

- **GIVEN** migration has been applied with indexes
- **WHEN** rollback migration is executed
- **THEN** idx_disclosure_log_unique index is dropped
- **AND** idx_disclosure_log_batch_fetch index is dropped
- **AND** disclosure_log table returns to original state
