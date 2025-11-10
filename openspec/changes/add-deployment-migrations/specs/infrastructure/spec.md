## ADDED Requirements

### Requirement: Automatic Database Migration on Deployment

The system SHALL automatically run database migrations during container startup
before accepting traffic.

#### Scenario: Successful migration on deployment

- **GIVEN** a container is starting with pending database migrations
- **WHEN** the container startup process begins
- **THEN** the system SHALL execute all pending migrations using drizzle-kit
- **AND** SHALL log migration start and completion
- **AND** SHALL start the Next.js server only after migrations complete
  successfully
- **AND** SHALL mark the container as healthy and ready to receive traffic

#### Scenario: Migration failure blocks deployment

- **GIVEN** a container is starting with a failing database migration
- **WHEN** the migration encounters an error
- **THEN** the system SHALL log the migration error details
- **AND** SHALL exit the container with non-zero status code
- **AND** SHALL NOT start the Next.js server
- **AND** SHALL keep the previous Cloud Run revision serving traffic
- **AND** SHALL mark the new revision deployment as failed

#### Scenario: No pending migrations

- **GIVEN** a container is starting with no pending database migrations
- **WHEN** the migration check runs
- **THEN** the system SHALL detect no pending migrations
- **AND** SHALL log that migrations are up to date
- **AND** SHALL proceed to start the Next.js server immediately
- **AND** SHALL complete startup in minimal time (<5 seconds)

#### Scenario: Concurrent container startup

- **GIVEN** multiple containers are starting simultaneously during deployment
- **WHEN** multiple containers attempt to run migrations concurrently
- **THEN** the system SHALL use database-level locking to coordinate
- **AND** SHALL allow the first container to execute migrations
- **AND** SHALL have subsequent containers detect migrations already applied
- **AND** SHALL have all containers proceed to start the server successfully

#### Scenario: Migration execution logging

- **GIVEN** migrations are running during container startup
- **WHEN** migration execution proceeds
- **THEN** the system SHALL log migration start to Cloud Run logs
- **AND** SHALL log each migration file being applied
- **AND** SHALL log migration completion with success status
- **AND** SHALL log any migration errors with full error details
- **AND** SHALL provide sufficient information for debugging failures

#### Scenario: Database connectivity failure during migration

- **GIVEN** a container is starting but cannot connect to the database
- **WHEN** the migration script attempts to connect
- **THEN** the system SHALL retry connection with exponential backoff
- **AND** SHALL log connection attempt failures
- **AND** SHALL exit with error after maximum retry attempts (5)
- **AND** SHALL NOT start the Next.js server
- **AND** SHALL fail the container startup

### Requirement: Migration Script Execution

The system SHALL use a wrapper script to coordinate migration execution and
server startup.

#### Scenario: Wrapper script execution order

- **GIVEN** the container starts
- **WHEN** the wrapper script executes
- **THEN** the system SHALL run migrations as the first step
- **AND** SHALL wait for migration completion
- **AND** SHALL start the Next.js server only after migration success
- **AND** SHALL use exec to replace the shell process with the server process

#### Scenario: Wrapper script error handling

- **GIVEN** the wrapper script is executing
- **WHEN** any command in the script fails
- **THEN** the system SHALL immediately stop execution (set -e)
- **AND** SHALL exit with the failed command's exit code
- **AND** SHALL NOT proceed to subsequent steps
- **AND** SHALL log the failure to Cloud Run logs

#### Scenario: Production dependencies availability

- **GIVEN** the Docker image is being built
- **WHEN** the build process installs dependencies
- **THEN** the system SHALL include drizzle-kit in production dependencies
- **AND** SHALL include drizzle-orm in production dependencies
- **AND** SHALL make migration command available at runtime
- **AND** SHALL ensure all migration files are copied to the image

## MODIFIED Requirements

### Requirement: Container Startup

The system SHALL execute database migrations before starting the application
server on every container startup.

#### Scenario: Cloud Run container initialization

- **GIVEN** Cloud Run is starting a new container instance
- **WHEN** the container initialization begins
- **THEN** the system SHALL execute the migration wrapper script
- **AND** SHALL run database migrations first
- **AND** SHALL start the Next.js server after migrations complete
- **AND** SHALL mark container as healthy only after server is ready
- **AND** SHALL route traffic only to healthy containers

#### Scenario: Container startup timeout

- **GIVEN** a container is starting with long-running migrations
- **WHEN** migrations take longer than expected
- **THEN** the system SHALL allow up to 240 seconds for startup (Cloud Run
  default)
- **AND** SHALL complete migrations within the timeout period
- **AND** SHALL fail the container if startup exceeds timeout
- **AND** SHALL log timeout error to Cloud Run logs

#### Scenario: Zero-downtime deployment with migrations

- **GIVEN** a new revision is being deployed with database migrations
- **WHEN** Cloud Run performs a rolling update
- **THEN** the system SHALL keep old revision serving traffic until new revision
  is healthy
- **AND** SHALL run migrations in new revision's first container
- **AND** SHALL start additional containers after migrations complete
- **AND** SHALL switch traffic to new revision only after health checks pass
- **AND** SHALL provide zero-downtime for users during the migration and
  deployment
