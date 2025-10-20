# Cron Secret Disclosure

## ADDED Requirements

### Requirement: Duplicate Disclosure Prevention

The system SHALL prevent duplicate disclosure emails to the same recipient for a
given secret using database-level constraints.

#### Scenario: Concurrent cron jobs attempt duplicate disclosure

- **GIVEN** a secret has been disclosed to recipient@example.com with
  status='sent'
- **WHEN** a concurrent cron job attempts to disclose the same secret to the
  same recipient
- **THEN** the database unique constraint prevents the duplicate INSERT
- **AND** the cron job gracefully handles the constraint violation
- **AND** the recipient does not receive a duplicate email

#### Scenario: Retry after partial failure does not duplicate

- **GIVEN** a secret was disclosed to recipient1@example.com (sent) but failed
  for recipient2@example.com
- **WHEN** the cron job retries the secret on the next run
- **THEN** recipient1@example.com is skipped (already sent)
- **AND** only recipient2@example.com receives the disclosure email

### Requirement: Retry Limit with Exponential Backoff

The system SHALL limit secret disclosure retries to 5 attempts with exponential
backoff, then mark the secret as failed.

#### Scenario: Secret fails permanently after max retries

- **GIVEN** a secret has failed disclosure 5 times due to decryption errors
- **WHEN** the cron job processes the secret on the 6th attempt
- **THEN** the secret status is set to 'failed'
- **AND** the secret is not retried on subsequent cron runs
- **AND** an error is logged for manual intervention

#### Scenario: Retry counter increments on failure

- **GIVEN** a secret with retry_count=2 fails disclosure due to email service
  error
- **WHEN** the processOverdueSecret function completes
- **THEN** retry_count is incremented to 3
- **AND** last_retry_at is set to current timestamp
- **AND** status remains 'active' for next retry

#### Scenario: Successful disclosure resets retry tracking

- **GIVEN** a secret with retry_count=3 successfully discloses to all recipients
- **WHEN** the disclosure completes
- **THEN** status is set to 'triggered'
- **AND** triggered_at is set to current timestamp
- **AND** retry_count is not modified (historical record)

### Requirement: Atomic Status Transitions

The system SHALL update secret status atomically based on disclosure success,
preventing secrets from being stuck in inconsistent states.

#### Scenario: All emails succeed sets triggered status

- **GIVEN** a secret with 3 recipients
- **WHEN** all 3 disclosure emails send successfully
- **THEN** status is set to 'triggered'
- **AND** triggered_at is set to current timestamp
- **AND** processing_started_at is cleared (set to NULL)
- **AND** last_error is cleared (set to NULL)

#### Scenario: Partial failure sets active status for retry

- **GIVEN** a secret with 3 recipients
- **WHEN** 2 emails succeed but 1 fails
- **THEN** status is set to 'active' (not 'triggered')
- **AND** triggered_at is set to NULL
- **AND** processing_started_at is cleared
- **AND** last_error contains "Sent: 2, Failed: 1"
- **AND** retry_count is incremented

#### Scenario: Complete failure sets active status for retry

- **GIVEN** a secret with 3 recipients
- **WHEN** all 3 disclosure emails fail
- **THEN** status is set to 'active'
- **AND** triggered_at is set to NULL
- **AND** processing_started_at is cleared
- **AND** last_error contains "Sent: 0, Failed: 3"
- **AND** retry_count is incremented

### Requirement: Timeout Recovery with Rollback

The system SHALL detect approaching cron timeout and rollback secrets to active
status for next run.

#### Scenario: Timeout during recipient processing triggers rollback

- **GIVEN** a secret is processing with 50 recipients
- **WHEN** cron timeout threshold is reached after 30 recipients processed
- **THEN** processing stops immediately
- **AND** secret status is reset to 'active'
- **AND** processing_started_at is cleared
- **AND** partial disclosure progress is logged
- **AND** next cron run will retry from beginning

#### Scenario: Timeout between secrets does not process more

- **GIVEN** 100 overdue secrets to process
- **WHEN** timeout threshold is reached after processing 80 secrets
- **THEN** remaining 20 secrets are not processed
- **AND** processed secrets retain their final status
- **AND** timeout is logged in metrics
- **AND** next cron run will process remaining secrets

### Requirement: Optimistic Locking with Race Condition Prevention

The system SHALL use optimistic locking to prevent concurrent processing of the
same secret by multiple cron jobs.

#### Scenario: First cron job wins optimistic lock

- **GIVEN** two cron jobs start simultaneously
- **WHEN** both attempt to UPDATE secret with status='active' condition
- **THEN** only one UPDATE succeeds and returns a row
- **AND** the winning job processes the secret
- **AND** the losing job skips the secret (already processing)

#### Scenario: Secret already triggered is skipped

- **GIVEN** a secret with status='triggered'
- **WHEN** the cron job queries overdue secrets
- **THEN** the secret is not included in results (query filters status='active')
- **AND** no processing is attempted

### Requirement: Batch Query Optimization

The system SHALL batch-fetch disclosure logs to prevent N+1 query patterns and
improve performance.

#### Scenario: Single query fetches all disclosure logs for secret

- **GIVEN** a secret with 50 recipients
- **WHEN** processOverdueSecret checks for existing disclosures
- **THEN** a single query fetches all existing disclosure logs for the secret
- **AND** results are stored in a Set for O(1) lookup
- **AND** no additional queries are made during recipient iteration

#### Scenario: Duplicate check uses in-memory set

- **GIVEN** disclosure logs have been batch-fetched into a Set
- **WHEN** iterating through 50 recipients
- **THEN** each duplicate check is O(1) lookup in Set
- **AND** no database queries are made during iteration

### Requirement: Continuous Parallel Processing with Worker Pool

The system SHALL process overdue secrets using a worker pool pattern that
maintains exactly 20 concurrent operations at all times until all secrets are
processed.

#### Scenario: Worker pool maintains 20 concurrent operations

- **GIVEN** 100 overdue secrets to process
- **WHEN** the cron job starts processing
- **THEN** 20 secrets begin processing immediately
- **AND** when any secret completes, the next secret starts immediately
- **AND** exactly 20 operations are active at any given time until queue is
  empty

#### Scenario: Worker completes early, next starts immediately

- **GIVEN** 20 secrets are actively processing
- **WHEN** 1 secret completes in 2 seconds (others still running)
- **THEN** the 21st secret starts immediately (within milliseconds)
- **AND** 20 operations remain active (not waiting for batch to complete)

#### Scenario: Worker pool drains queue completely

- **GIVEN** 100 overdue secrets
- **WHEN** processing completes
- **THEN** all 100 secrets have been attempted
- **AND** the queue is empty
- **AND** no secrets remain in active set

#### Scenario: Worker failure does not stop pool

- **GIVEN** a worker processing a secret encounters an exception
- **WHEN** the exception is caught
- **THEN** the failed secret is logged
- **AND** the worker is removed from active set
- **AND** the next secret starts processing immediately
- **AND** other workers continue unaffected

### Requirement: Memory Security for Decrypted Content

The system SHALL minimize exposure of decrypted secret content in memory by
clearing it immediately after use.

#### Scenario: Decrypted content cleared after disclosure loop

- **GIVEN** a secret is decrypted for disclosure
- **WHEN** all recipients have been processed (success or failure)
- **THEN** the decrypted content variable is set to empty string
- **AND** memory is eligible for garbage collection

#### Scenario: Decrypted content cleared even on exception

- **GIVEN** a secret is decrypted for disclosure
- **WHEN** an exception occurs during recipient processing
- **THEN** the decrypted content is cleared in finally block
- **AND** memory does not retain sensitive data

### Requirement: Email Success with Database Failure Handling

The system SHALL handle scenarios where email sends successfully but database
update fails, preventing duplicate sends on retry.

#### Scenario: DB update fails after successful email send

- **GIVEN** an email sends successfully to a recipient
- **WHEN** the disclosure_log UPDATE fails due to database error
- **THEN** the sent counter is still incremented
- **AND** a warning is logged for manual investigation
- **AND** the next retry will skip this recipient (marked as sent in counter)

#### Scenario: Failed DB update logged for investigation

- **GIVEN** email sent but DB update failed
- **WHEN** processing completes
- **THEN** an email failure log is created with type='disclosure-db-error'
- **AND** admin notification is sent
- **AND** error includes both email success and DB failure details

### Requirement: Type Safety with Schema Types

The system SHALL use proper TypeScript types from database schema instead of
`any` types for type safety.

#### Scenario: Function signatures use schema types

- **GIVEN** the processOverdueSecret function
- **WHEN** the function is defined
- **THEN** secret parameter uses `Secret` type from schema
- **AND** user parameter uses `User` type from schema
- **AND** TypeScript compiler enforces correct property access

#### Scenario: Type errors caught at compile time

- **GIVEN** code attempts to access non-existent property on secret
- **WHEN** TypeScript compilation runs
- **THEN** compilation fails with type error
- **AND** issue is caught before runtime

### Requirement: Drizzle Query Builder for SQL Operations

The system SHALL use Drizzle ORM query builder instead of raw SQL for type
safety and consistency.

#### Scenario: Status updates use query builder

- **GIVEN** a need to update secret status
- **WHEN** the update operation is performed
- **THEN** db.update(secrets).set().where() is used
- **AND** no raw SQL strings are constructed
- **AND** TypeScript validates column names and types

#### Scenario: Optimistic locking uses query builder

- **GIVEN** optimistic locking check for concurrent processing
- **WHEN** the UPDATE with WHERE condition is executed
- **THEN** Drizzle query builder constructs the SQL
- **AND** returning() clause provides type-safe result
- **AND** no SQL injection risk exists

### Requirement: Prevent Logging of Encryption Secrets

The system SHALL ensure server_share, decrypted content, and encryption keys are
NEVER logged to prevent secret exposure.

#### Scenario: Error logs do not contain server_share

- **GIVEN** an error occurs during secret processing
- **WHEN** the error is logged via console.error or logger
- **THEN** the server_share field is explicitly stripped from logs
- **AND** only the secret.id is included for identification
- **AND** sanitizeError function removes sensitive fields

#### Scenario: Decryption failures do not log sensitive data

- **GIVEN** decryption fails due to invalid server_share
- **WHEN** the error is caught and logged
- **THEN** the error message does not include server_share value
- **AND** the error message does not include iv or authTag values
- **AND** only the secret.id and error type are logged

#### Scenario: Console logs use sanitized objects

- **GIVEN** any console.log or console.error call in cron job
- **WHEN** logging information about a secret
- **THEN** the entire secret object is NOT logged
- **AND** only allowlisted fields (id, title, status) are logged
- **AND** server_share, iv, authTag are never in logs

### Requirement: Processing Time Monitoring and Alerting

The system SHALL monitor processing duration and log warnings when exceeding the
cron interval (15 minutes).

#### Scenario: Warning logged when exceeding cron interval

- **GIVEN** processing 5000 secrets takes 21 minutes
- **WHEN** elapsed time exceeds 15 minutes (CRON_INTERVAL_MS)
- **THEN** a warning is logged with elapsed time and remaining queue length
- **AND** processing continues until all secrets processed
- **AND** warning is logged only once per run

#### Scenario: Metrics include duration and throughput

- **GIVEN** processing completes after 4 minutes
- **WHEN** final metrics are logged
- **THEN** total duration in seconds is included
- **AND** throughput (secrets/second) is calculated
- **AND** total processed count is logged

#### Scenario: Normal processing does not warn

- **GIVEN** processing 100 secrets takes 25 seconds
- **WHEN** processing completes
- **THEN** no warning is logged (under 15 minute threshold)
- **AND** success metrics are logged

### Requirement: Graceful Handling of Overlapping Cron Runs

The system SHALL handle scenarios where Cloud Scheduler triggers a new job while
the previous job is still running due to high volume.

#### Scenario: Optimistic locking prevents duplicate processing during overlap

- **GIVEN** a cron job is processing 5000 secrets (taking 21 minutes)
- **WHEN** Cloud Scheduler triggers second job at 15-minute mark
- **THEN** second job queries for overdue secrets with status='active'
- **AND** first job has already set status='triggered' or processing_started_at
- **AND** second job finds no secrets to process (or fewer secrets)
- **AND** no duplicate processing occurs

#### Scenario: Overlap event logged for monitoring

- **GIVEN** two cron jobs running simultaneously
- **WHEN** second job starts and finds fewer secrets than expected
- **THEN** overlap condition is detected and logged
- **AND** metrics indicate potential capacity issue
- **AND** processing completes normally without errors

#### Scenario: High volume triggers capacity planning alert

- **GIVEN** processing consistently exceeds 15 minutes (multiple runs)
- **WHEN** monitoring system detects pattern
- **THEN** alert is sent for capacity planning
- **AND** recommendation to increase MAX_CONCURRENT_SECRETS or optimize
  processing
- **AND** system continues to function correctly (not a failure condition)
