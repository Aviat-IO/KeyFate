## ADDED Requirements

### Requirement: Cloud SQL Auth Proxy Integration

The infrastructure SHALL use Cloud SQL Auth Proxy for secure database
connections without exposing public IP addresses.

#### Scenario: Cloud Run built-in proxy configuration

- **GIVEN** a Cloud Run service needs to connect to Cloud SQL
- **WHEN** the infrastructure is provisioned
- **THEN** the system SHALL configure Cloud Run with gen2 execution environment
- **AND** SHALL mount Cloud SQL connection as a volume at `/cloudsql`
- **AND** SHALL grant service account `roles/cloudsql.client` permission
- **AND** SHALL configure DATABASE_URL with Unix socket format:
  `postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE`

#### Scenario: Secure private-only database

- **GIVEN** Cloud SQL instances are provisioned
- **WHEN** network configuration is applied
- **THEN** the system SHALL disable public IP addresses (`public_ipv4 = false`)
- **AND** SHALL configure private IP with VPC peering
- **AND** SHALL NOT configure authorized networks (not needed without public IP)
- **AND** SHALL verify Cloud SQL instance is reachable only via private network

#### Scenario: Automatic TLS encryption

- **GIVEN** application connects to Cloud SQL via built-in proxy
- **WHEN** database connection is established
- **THEN** Cloud SQL Auth Proxy SHALL automatically encrypt traffic using TLS
  1.3
- **AND** SHALL handle SSL certificate management automatically
- **AND** SHALL rotate certificates before expiration
- **AND** SHALL authenticate using service account IAM credentials

#### Scenario: Connection health monitoring

- **GIVEN** Cloud SQL Auth Proxy is running via Cloud Run integration
- **WHEN** database connectivity is monitored
- **THEN** the system SHALL log connection attempts in Cloud Run logs
- **AND** SHALL log authentication events in Cloud Audit Logs
- **AND** SHALL detect and log connection failures with error details
- **AND** SHALL expose connection errors via application health check endpoint

#### Scenario: Proxy connection failure handling

- **GIVEN** Cloud SQL Auth Proxy cannot connect to database
- **WHEN** application attempts database operation
- **THEN** the system SHALL return connection error to application
- **AND** SHALL log error with details (IAM permission, network, instance state)
- **AND** SHALL retry connection with application-level backoff logic
- **AND** SHALL return 503 Service Unavailable to clients after retry exhaustion

#### Scenario: Zero-downtime database maintenance

- **GIVEN** Cloud SQL instance requires maintenance
- **WHEN** maintenance window begins
- **THEN** Cloud SQL Auth Proxy SHALL handle failover automatically for HA
  instances
- **AND** SHALL re-establish connections transparently
- **AND** SHALL log any connection interruptions
- **AND** application SHALL retry failed queries per connection pooling logic

## MODIFIED Requirements

### Requirement: Database Connection Pooling

The system SHALL manage database connections with explicit pool configuration
and retry logic over Cloud SQL Auth Proxy Unix sockets.

#### Scenario: Connection pool configuration

- **GIVEN** the application connects to the database via Cloud SQL Auth Proxy
- **WHEN** the connection pool is initialized
- **THEN** the system SHALL connect via Unix socket path
  `/cloudsql/PROJECT:REGION:INSTANCE/.s.PGSQL.5432`
- **AND** SHALL set max connections to 5 for Cloud Run (reduced from 10/20 to
  prevent socket exhaustion)
- **AND** SHALL set connection timeout to 10 seconds
- **AND** SHALL set idle timeout to 20 seconds
- **AND** SHALL set statement timeout to 30 seconds
- **AND** SHALL enable connection keep-alive

#### Scenario: Connection retry with exponential backoff

- **GIVEN** a database connection attempt fails
- **WHEN** the failure is transient (network error, connection refused, proxy
  starting)
- **THEN** the system SHALL retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
- **AND** SHALL log each retry attempt with proxy connection status
- **AND** SHALL fail after 5 retry attempts with clear error message
- **AND** SHALL distinguish between proxy errors (socket not found) and database
  errors (authentication failed)

#### Scenario: Connection pool exhaustion

- **GIVEN** all connections in the pool are in use
- **WHEN** a new request requires a database connection
- **THEN** the system SHALL wait up to 10 seconds for an available connection
  (increased from 5s for proxy warmup)
- **AND** SHALL return 503 status if no connection becomes available
- **AND** SHALL log connection pool exhaustion event with Cloud SQL Auth Proxy
  status
