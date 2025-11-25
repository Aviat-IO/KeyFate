## ADDED Requirements

### Requirement: Server Environment Variable Protection

The system SHALL prevent accidental exposure of server-only environment
variables in client-side code bundles.

#### Scenario: Runtime client-side detection

- **GIVEN** server-env.ts module is imported
- **WHEN** code runs in browser environment
- **THEN** the system SHALL detect window object exists
- **AND** SHALL throw clear error indicating server-only module
- **AND** SHALL prevent execution of server-only code client-side

#### Scenario: Build-time webpack protection

- **GIVEN** application is built for production
- **WHEN** webpack bundles client-side code
- **THEN** the system SHALL alias server-only modules to false for client bundle
- **AND** SHALL prevent server-env.ts from being included in client bundle
- **AND** SHALL prevent encryption.ts from being included in client bundle
- **AND** SHALL fail build if server modules are incorrectly imported
  client-side

#### Scenario: Separate client environment module

- **GIVEN** client-side code needs environment variables
- **WHEN** client code accesses environment
- **THEN** the system SHALL use separate client-env.ts module
- **AND** SHALL only expose NEXT_PUBLIC_\* variables to client
- **AND** SHALL provide type-safe access to client environment variables
- **AND** SHALL document which variables are safe for client usage

#### Scenario: Development warning on violation

- **GIVEN** developer accidentally imports server module client-side
- **WHEN** development build runs
- **THEN** the system SHALL show clear warning in console
- **AND** SHALL indicate which import is problematic
- **AND** SHALL suggest correct alternative
- **AND** SHALL fail fast to prevent production exposure

### Requirement: Request Size Limits

The system SHALL enforce request size limits to prevent denial-of-service
attacks via large payloads.

#### Scenario: Body parser size configuration

- **GIVEN** Next.js application accepts requests
- **WHEN** request body is parsed
- **THEN** the system SHALL limit JSON bodies to 1MB
- **AND** SHALL limit form bodies to 100KB
- **AND** SHALL reject oversized requests with 413 status
- **AND** SHALL include clear error message indicating size limit

#### Scenario: File upload limits

- **GIVEN** file uploads are supported (future feature)
- **WHEN** files are uploaded
- **THEN** the system SHALL limit individual files to 5MB
- **AND** SHALL limit total upload size per request to 10MB
- **AND** SHALL reject oversized uploads with 413 status
- **AND** SHALL validate file size before processing

#### Scenario: Request header size limits

- **GIVEN** HTTP requests include headers
- **WHEN** headers are parsed
- **THEN** the system SHALL limit total header size to 8KB
- **AND** SHALL limit individual header values to 4KB
- **AND** SHALL reject oversized headers with 431 status

### Requirement: External Service Retry Logic

The system SHALL implement retry logic with exponential backoff for external API
calls to improve reliability.

#### Scenario: Stripe API retry

- **GIVEN** a Stripe API call fails with transient error
- **WHEN** error is network timeout or 5xx status
- **THEN** the system SHALL retry with exponential backoff (1s, 2s, 4s)
- **AND** SHALL limit to 3 retry attempts
- **AND** SHALL log each retry attempt
- **AND** SHALL fail after max retries with clear error

#### Scenario: BTCPay API retry

- **GIVEN** a BTCPay API call fails with transient error
- **WHEN** error is network timeout or 5xx status
- **THEN** the system SHALL retry with exponential backoff
- **AND** SHALL limit to 3 retry attempts
- **AND** SHALL handle invoice creation failures gracefully

#### Scenario: Email service retry

- **GIVEN** email send fails with transient error
- **WHEN** circuit breaker is CLOSED
- **THEN** the system SHALL retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
- **AND** SHALL limit to 5 retry attempts for critical emails
- **AND** SHALL queue for later retry if all attempts fail
- **AND** SHALL not retry for permanent failures (invalid email, auth failure)

#### Scenario: Retry on specific error codes

- **GIVEN** external API returns error
- **WHEN** determining if retry is appropriate
- **THEN** the system SHALL retry on 408, 429, 500, 502, 503, 504 status codes
- **AND** SHALL respect Retry-After header if present
- **AND** SHALL not retry on 4xx client errors (except 408, 429)
- **AND** SHALL log non-retryable errors for investigation

### Requirement: Email Service Circuit Breaker

The system SHALL implement circuit breaker pattern for email service to prevent
cascading failures during outages.

#### Scenario: Circuit breaker CLOSED state

- **GIVEN** email service is operational
- **WHEN** emails are sent successfully
- **THEN** the circuit breaker SHALL remain in CLOSED state
- **AND** SHALL allow all email requests through
- **AND** SHALL reset failure counter on each success

#### Scenario: Circuit breaker OPEN state

- **GIVEN** email service has 5 consecutive failures
- **WHEN** failure threshold is reached
- **THEN** the circuit breaker SHALL transition to OPEN state
- **AND** SHALL fail fast on subsequent email requests without calling API
- **AND** SHALL queue emails for later retry
- **AND** SHALL send admin alert about service outage
- **AND** SHALL log circuit state transition

#### Scenario: Circuit breaker HALF_OPEN state

- **GIVEN** circuit breaker is OPEN
- **WHEN** timeout period expires (60 seconds)
- **THEN** the circuit breaker SHALL transition to HALF_OPEN state
- **AND** SHALL allow 3 test requests through to check service recovery
- **AND** SHALL transition to CLOSED on successful test
- **AND** SHALL return to OPEN if test requests fail

#### Scenario: Email queue for retry

- **GIVEN** circuit breaker is OPEN
- **WHEN** critical email needs to be sent
- **THEN** the system SHALL queue email for later retry
- **AND** SHALL attempt queue processing when circuit closes
- **AND** SHALL preserve email content and metadata
- **AND** SHALL limit queue size to prevent memory issues (max 1000 emails)

#### Scenario: Circuit breaker monitoring

- **GIVEN** circuit breaker state changes
- **WHEN** OPEN or HALF_OPEN state is entered
- **THEN** the system SHALL expose metrics to monitoring system
- **AND** SHALL alert operations team on circuit open
- **AND** SHALL provide dashboard showing circuit state and failure rates

## MODIFIED Requirements

### Requirement: Database Connection Pooling

The system SHALL manage database connections with explicit pool configuration,
health monitoring, and graceful shutdown.

#### Scenario: Connection pool configuration

- **GIVEN** the application connects to the database
- **WHEN** the connection pool is initialized
- **THEN** the system SHALL set max connections to 20 for production
- **AND** SHALL set min idle connections to 2
- **AND** SHALL set connection timeout to 10 seconds
- **AND** SHALL set idle timeout to 30 seconds
- **AND** SHALL enable connection keep-alive with 10s initial delay
- **AND** SHALL recycle connections after 7500 uses

#### Scenario: Connection pool health monitoring

- **GIVEN** connection pool is active
- **WHEN** pool events occur
- **THEN** the system SHALL log connection establishment
- **AND** SHALL log connection removal from pool
- **AND** SHALL log unexpected pool errors
- **AND** SHALL expose pool metrics (active, idle, waiting)
- **AND** SHALL alert if pool utilization exceeds 80%

#### Scenario: Graceful shutdown on SIGTERM

- **GIVEN** application receives SIGTERM signal
- **WHEN** shutdown is initiated
- **THEN** the system SHALL stop accepting new requests
- **AND** SHALL wait for in-flight requests to complete (max 30s)
- **AND** SHALL close database connection pool gracefully
- **AND** SHALL log shutdown completion
- **AND** SHALL exit with code 0 on successful shutdown

#### Scenario: Connection retry with exponential backoff

- **GIVEN** a database connection attempt fails
- **WHEN** the failure is transient (network error, connection refused)
- **THEN** the system SHALL retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
- **AND** SHALL log each retry attempt
- **AND** SHALL fail after 5 retry attempts with clear error message

#### Scenario: Connection pool exhaustion

- **GIVEN** all connections in the pool are in use
- **WHEN** a new request requires a database connection
- **THEN** the system SHALL wait up to 10 seconds for an available connection
- **AND** SHALL return 503 status if no connection becomes available
- **AND** SHALL log connection pool exhaustion event
- **AND** SHALL alert operations team if exhaustion persists

### Requirement: Enhanced Health Checks

The system SHALL provide comprehensive health checks for all critical subsystems
including external services.

#### Scenario: Database connectivity check

- **GIVEN** a health check request is received
- **WHEN** the system queries database connectivity
- **THEN** the system SHALL execute a simple query (SELECT 1)
- **AND** SHALL return success if query completes within 2 seconds
- **AND** SHALL return failure with error details if query fails or times out

#### Scenario: Email service validation

- **GIVEN** a health check request is received
- **WHEN** the system validates email service
- **THEN** the system SHALL verify SMTP credentials are configured
- **AND** SHALL check circuit breaker state
- **AND** SHALL return degraded status if circuit is OPEN
- **AND** SHALL optionally test connection to SMTP server (configurable)
- **AND** SHALL return success if email service is available

#### Scenario: Payment provider validation

- **GIVEN** a health check request is received
- **WHEN** the system validates payment providers
- **THEN** the system SHALL check Stripe API connectivity
- **AND** SHALL check BTCPay Server connectivity if configured
- **AND** SHALL return degraded status if either provider is unavailable
- **AND** SHALL not block health check on payment provider failures

#### Scenario: Encryption key validation

- **GIVEN** a health check request is received
- **WHEN** the system validates encryption configuration
- **THEN** the system SHALL verify ENCRYPTION_KEY is set and correct length
- **AND** SHALL perform a test encryption/decryption cycle
- **AND** SHALL verify key entropy meets requirements
- **AND** SHALL return success if encryption operations work correctly

#### Scenario: Readiness vs liveness

- **GIVEN** the system provides both readiness and liveness endpoints
- **WHEN** /api/health/live is called
- **THEN** the system SHALL return success if the application process is running
- **WHEN** /api/health/ready is called
- **THEN** the system SHALL return success only if database is operational and
  encryption is functional
- **AND** SHALL return degraded if email or payment services are down but core
  functionality works

### Requirement: Startup Environment Validation

The system SHALL validate all required environment variables before accepting
traffic, including key quality checks.

#### Scenario: Successful validation

- **GIVEN** all required environment variables are set with valid values
- **WHEN** the application starts
- **THEN** the system SHALL complete validation checks
- **AND** SHALL log successful validation
- **AND** SHALL proceed to accept traffic

#### Scenario: Missing required variable

- **GIVEN** a required environment variable is not set
- **WHEN** the application starts
- **THEN** the system SHALL fail validation
- **AND** SHALL exit with non-zero status code
- **AND** SHALL log a clear error message indicating which variable is missing

#### Scenario: Invalid encryption key

- **GIVEN** ENCRYPTION_KEY is set but not 32 bytes when base64-decoded
- **WHEN** the application starts
- **THEN** the system SHALL fail validation
- **AND** SHALL exit with error message indicating correct key length
  requirement
- **AND** SHALL check key entropy and reject weak keys
- **AND** SHALL reject keys matching weak patterns

#### Scenario: Invalid authentication secrets

- **GIVEN** NEXTAUTH_SECRET, CRON_SECRET, or ADMIN_TOKEN is less than 32
  characters
- **WHEN** the application starts
- **THEN** the system SHALL fail validation
- **AND** SHALL exit with error indicating minimum length requirement

#### Scenario: Invalid database connection string

- **GIVEN** DATABASE_URL is not a valid PostgreSQL connection string
- **WHEN** the application starts
- **THEN** the system SHALL fail validation
- **AND** SHALL exit with error indicating correct format
