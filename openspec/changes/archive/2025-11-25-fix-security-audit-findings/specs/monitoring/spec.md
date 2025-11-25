## ADDED Requirements

### Requirement: Cron Job Monitoring and Alerting

The system SHALL implement comprehensive monitoring for all cron jobs with
automatic anomaly detection and alerting.

#### Scenario: Job execution metrics collection

- **GIVEN** a cron job executes
- **WHEN** the job completes
- **THEN** the system SHALL record execution duration
- **AND** SHALL record counts of processed, succeeded, and failed items
- **AND** SHALL record timestamp and job name
- **AND** SHALL send metrics to Cloud Monitoring
- **AND** SHALL log structured metrics with request ID

#### Scenario: Job failure detection and alerting

- **GIVEN** a cron job fails
- **WHEN** uncaught exception occurs or job times out
- **THEN** the system SHALL capture full error details with stack trace
- **AND** SHALL send error to APM (Sentry) with job context
- **AND** SHALL send immediate alert to operations team
- **AND** SHALL include error message, job name, and failure context in alert
- **AND** SHALL log critical error with request ID for correlation

#### Scenario: High failure rate detection

- **GIVEN** a cron job processes multiple items
- **WHEN** failure rate exceeds 10% and at least 10 items processed
- **THEN** the system SHALL detect anomalous failure rate
- **AND** SHALL send alert with failure statistics
- **AND** SHALL not alert on small sample sizes (<10 items)
- **AND** SHALL log anomaly detection for investigation

#### Scenario: Slow execution detection

- **GIVEN** a cron job has expected execution duration
- **WHEN** actual duration exceeds 2x expected duration
- **THEN** the system SHALL detect slow execution
- **AND** SHALL send alert with duration comparison
- **AND** SHALL include expected vs actual duration in alert
- **AND** SHALL log performance degradation for investigation

#### Scenario: Job execution history tracking

- **GIVEN** cron jobs run over time
- **WHEN** metrics are collected
- **THEN** the system SHALL maintain execution history in monitoring system
- **AND** SHALL enable trend analysis of job performance
- **AND** SHALL support dashboards showing job health over time
- **AND** SHALL retain metrics for 90 days minimum

#### Scenario: Expected duration configuration

- **GIVEN** each cron job has different performance characteristics
- **WHEN** slow execution is detected
- **THEN** the system SHALL use job-specific expected duration
- **AND** SHALL default to 60 seconds if not specified
- **AND** SHALL allow configuration per job (check-secrets: 30s,
  process-reminders: 60s, process-exports: 120s, process-deletions: 60s)

### Requirement: Request Context Propagation

The system SHALL propagate request context through entire request lifecycle
using AsyncLocalStorage for distributed tracing.

#### Scenario: Request context initialization

- **GIVEN** a cron job request is received
- **WHEN** request processing begins
- **THEN** the system SHALL create AsyncLocalStorage context
- **AND** SHALL include unique request ID (UUID v4)
- **AND** SHALL include job name
- **AND** SHALL include start timestamp
- **AND** SHALL propagate context to all async operations

#### Scenario: Request context access in nested calls

- **GIVEN** request context is initialized
- **WHEN** nested functions or async operations execute
- **THEN** functions SHALL access context via getRequestContext()
- **AND** SHALL include request ID in all log entries
- **AND** SHALL include job name in all log entries
- **AND** SHALL maintain context across async boundaries

#### Scenario: Logger integration with context

- **GIVEN** request context is available
- **WHEN** logs are written
- **THEN** the logger SHALL automatically include request ID
- **AND** SHALL automatically include job name
- **AND** SHALL automatically include user ID if available
- **AND** SHALL enable log correlation across entire request

#### Scenario: Context cleanup

- **GIVEN** request processing completes
- **WHEN** request context exits
- **THEN** the system SHALL clean up AsyncLocalStorage
- **AND** SHALL not leak context across requests
- **AND** SHALL handle errors without context leakage

### Requirement: Database Query Performance Monitoring

The system SHALL monitor and optimize database query performance with
appropriate indexes.

#### Scenario: Critical index creation

- **GIVEN** cron jobs query secrets table
- **WHEN** queries filter by status and next_check_in
- **THEN** the system SHALL use composite index idx_secrets_status_next_checkin
- **AND** SHALL create partial index with WHERE clause for status = 'active'
- **AND** SHALL avoid full table scans on large datasets

#### Scenario: Retry lookup optimization

- **GIVEN** cron jobs query secrets with retry logic
- **WHEN** queries filter by status, last_retry_at, and retry_count
- **THEN** the system SHALL use composite index idx_secrets_retry_lookup
- **AND** SHALL efficiently find secrets eligible for retry
- **AND** SHALL minimize query execution time

#### Scenario: Processing state tracking

- **GIVEN** cron jobs track which secrets are being processed
- **WHEN** queries filter by processing_started_at
- **THEN** the system SHALL use index idx_secrets_processing_started
- **AND** SHALL quickly identify stuck secrets
- **AND** SHALL support timeout detection

#### Scenario: Query performance measurement

- **GIVEN** database queries are executed
- **WHEN** query completes
- **THEN** the system SHALL measure query execution time
- **AND** SHALL log slow queries (>100ms)
- **AND** SHALL send slow query metrics to APM
- **AND** SHALL enable query performance optimization

#### Scenario: Index maintenance

- **GIVEN** indexes are created
- **WHEN** production deployment occurs
- **THEN** the system SHALL use CREATE INDEX CONCURRENTLY for non-blocking
  creation
- **AND** SHALL run ANALYZE after index creation
- **AND** SHALL monitor index usage and effectiveness
- **AND** SHALL document index purpose and query patterns

## MODIFIED Requirements

### Requirement: Request ID Tracing

The system SHALL assign unique request IDs for distributed tracing and log
correlation, with AsyncLocalStorage propagation for cron jobs.

#### Scenario: Request ID generation

- **GIVEN** a new HTTP request is received
- **WHEN** the request enters the system
- **THEN** the system SHALL generate a unique request ID (UUID v4)
- **AND** SHALL attach the ID to the request context
- **AND** SHALL include the ID in the response headers (X-Request-ID)

#### Scenario: Request ID propagation in API routes

- **GIVEN** a request has an assigned request ID
- **WHEN** the request makes internal calls (database, external APIs)
- **THEN** the system SHALL include the request ID in all log entries
- **AND** SHALL pass the request ID to downstream services
- **AND** SHALL enable end-to-end request tracing

#### Scenario: Request ID propagation in cron jobs

- **GIVEN** a cron job request is received
- **WHEN** job processing begins
- **THEN** the system SHALL generate unique request ID
- **AND** SHALL store in AsyncLocalStorage context
- **AND** SHALL automatically include in all logs within job execution
- **AND** SHALL propagate through all nested async operations
- **AND** SHALL enable complete job execution tracing

#### Scenario: Request ID correlation

- **GIVEN** an error occurs during request processing
- **WHEN** investigating the error
- **THEN** the operator SHALL be able to search logs by request ID
- **AND** SHALL see all log entries related to that request
- **AND** SHALL trace the request flow across components
- **AND** SHALL correlate frontend, backend, and cron job logs

### Requirement: Structured Logging with Sanitization

The system SHALL implement structured logging that automatically sanitizes
sensitive data and includes request context.

#### Scenario: Sensitive data redaction

- **GIVEN** a log entry contains data with sensitive field names
- **WHEN** the log is written
- **THEN** the system SHALL redact fields matching sensitive patterns
  (serverShare, encryptedShare, secret, token, password, key, otp, csrfToken)
- **AND** SHALL replace values with [REDACTED] placeholder
- **AND** SHALL preserve non-sensitive context for debugging

#### Scenario: Structured log format with context

- **GIVEN** any log event occurs
- **WHEN** the log is written
- **THEN** the system SHALL use JSON format with standard fields (level,
  message, timestamp)
- **AND** SHALL automatically include requestId from context
- **AND** SHALL automatically include jobName for cron jobs
- **AND** SHALL include sanitized context data
- **AND** SHALL include request metadata (method, path, userId) when available

#### Scenario: Log level configuration

- **GIVEN** the application is running
- **WHEN** logs are written
- **THEN** the system SHALL respect LOG_LEVEL environment variable (debug, info,
  warn, error)
- **AND** SHALL only output logs at or above configured level
- **AND** SHALL default to 'info' level if not specified

#### Scenario: Sensitive data leak prevention

- **GIVEN** an error contains sensitive data in stack trace or message
- **WHEN** the error is logged
- **THEN** the system SHALL scan for sensitive patterns before logging
- **AND** SHALL redact any detected sensitive values
- **AND** SHALL log a warning if sensitive data was found and redacted

### Requirement: Security Event Logging

The system SHALL log security-relevant events for audit and incident response,
including new security mechanisms.

#### Scenario: Authentication events

- **GIVEN** authentication events occur
- **WHEN** user logs in, fails login, or locks out
- **THEN** the system SHALL log the event with timestamp, userId, email, IP
  address, and outcome
- **AND** SHALL log rate limit violations (email-based and IP-based)
- **AND** SHALL log OTP generation and validation attempts
- **AND** SHALL log account lockout events with lockout type (temporary,
  extended, permanent)

#### Scenario: Authorization events

- **GIVEN** authorization checks occur
- **WHEN** access is granted or denied
- **THEN** the system SHALL log the event with userId, resource, action, and
  outcome
- **AND** SHALL log CSRF validation failures
- **AND** SHALL log email verification enforcement
- **AND** SHALL log input validation failures for sensitive endpoints

#### Scenario: Administrative actions

- **GIVEN** administrative actions occur
- **WHEN** admin endpoints are accessed
- **THEN** the system SHALL log the action with admin token hash, IP address,
  and action details
- **AND** SHALL log all secret access and modifications
- **AND** SHALL log account lockout overrides
- **AND** SHALL maintain audit trail for Pro users indefinitely

#### Scenario: Security anomalies

- **GIVEN** anomalous security events occur
- **WHEN** webhook replay detected, cron authentication fails, or unusual access
  patterns emerge
- **THEN** the system SHALL log the anomaly with full context
- **AND** SHALL log circuit breaker state changes
- **AND** SHALL log encryption key validation failures
- **AND** SHALL send alert if severity is high
- **AND** SHALL enable incident response investigation
