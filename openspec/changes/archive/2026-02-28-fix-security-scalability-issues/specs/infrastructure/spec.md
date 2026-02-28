# infrastructure Spec Delta

## MODIFIED Requirements

### Requirement: Database Connection Pooling

The system SHALL manage database connections with dynamic pool sizing based on
Cloud Run instance count.

#### Scenario: Dynamic pool size calculation

- **GIVEN** the application initializes database connection pool
- **WHEN** calculating pool size
- **THEN** the system SHALL read CLOUD_RUN_CONCURRENCY environment variable
  (default 80)
- **AND** SHALL read EXPECTED_INSTANCES environment variable (default 10)
- **AND** SHALL read CLOUDSQL_MAX_CONNECTIONS environment variable (default 100)
- **AND** SHALL calculate pool size as (max_connections \* 0.8) /
  expected_instances
- **AND** SHALL use minimum pool size of 2 connections

#### Scenario: Connection pool monitoring

- **GIVEN** the application is running
- **WHEN** monitoring connection pool health
- **THEN** the system SHALL track active connection count
- **AND** SHALL track idle connection count
- **AND** SHALL track waiting request count
- **AND** SHALL expose metrics via health check endpoint

#### Scenario: Pool exhaustion graceful degradation

- **GIVEN** all connections in pool are in use
- **WHEN** a new request needs database connection
- **THEN** the system SHALL wait up to 5 seconds for available connection
- **AND** SHALL return 503 Service Unavailable if timeout occurs
- **AND** SHALL include Retry-After header with suggested delay
- **AND** SHALL log pool exhaustion event with context

## ADDED Requirements

### Requirement: Database Performance Indexes

The system SHALL create and maintain indexes for all critical query patterns.

#### Scenario: Overdue secrets index

- **GIVEN** the database schema includes secrets table
- **WHEN** cron job queries for overdue secrets
- **THEN** the system SHALL use composite index on (status, next_check_in,
  last_retry_at, retry_count)
- **AND** SHALL use partial index with WHERE status = 'active'
- **AND** SHALL complete query in <10ms for 10,000 secrets

#### Scenario: Webhook deduplication index

- **GIVEN** webhook events are stored for replay prevention
- **WHEN** checking for duplicate webhooks
- **THEN** the system SHALL use composite index on (provider, event_id)
- **AND** SHALL complete lookup in <1ms

#### Scenario: Index maintenance

- **GIVEN** indexes exist on database tables
- **WHEN** database maintenance runs
- **THEN** the system SHALL use EXPLAIN ANALYZE to verify index usage
- **AND** SHALL alert if indexes are not being used (seq scan detected)
- **AND** SHALL monitor index bloat and trigger REINDEX when needed

### Requirement: Unlogged Tables for Ephemeral Data

The system SHALL use PostgreSQL unlogged tables for non-critical ephemeral data.

#### Scenario: Rate limiting table configuration

- **GIVEN** rate_limits table is created
- **WHEN** defining table structure
- **THEN** the system SHALL create as UNLOGGED table
- **AND** SHALL include expires_at timestamp column
- **AND** SHALL create index on expires_at for cleanup queries

#### Scenario: Unlogged table data loss handling

- **GIVEN** PostgreSQL crashes or restarts
- **WHEN** unlogged table data is lost
- **THEN** the system SHALL continue operating normally
- **AND** SHALL rebuild rate limiting data from new requests
- **AND** SHALL log warning about data loss
- **AND** SHALL not affect critical user data (secrets, accounts)

### Requirement: Advisory Lock Management

The system SHALL provide helper functions for PostgreSQL advisory lock
operations.

#### Scenario: Lock acquisition

- **GIVEN** a distributed operation needs coordination
- **WHEN** acquiring advisory lock
- **THEN** the system SHALL hash lock identifier to 64-bit integer
- **AND** SHALL use `pg_try_advisory_lock()` for non-blocking acquire
- **AND** SHALL return boolean indicating success
- **AND** SHALL log lock acquisition attempts

#### Scenario: Lock release

- **GIVEN** an advisory lock is held
- **WHEN** releasing the lock
- **THEN** the system SHALL use `pg_advisory_unlock()` with same hash
- **AND** SHALL verify lock was held before release
- **AND** SHALL log lock release

#### Scenario: Automatic lock cleanup

- **GIVEN** a database connection holding locks is closed
- **WHEN** connection terminates unexpectedly
- **THEN** PostgreSQL SHALL automatically release all advisory locks
- **AND** the system SHALL not require manual cleanup
- **AND** SHALL log connection termination events
