## MODIFIED Requirements

### Requirement: Enhanced Health Checks

The system SHALL provide separate process liveness and bounded dependency/configuration readiness endpoints.

#### Scenario: Liveness

- **WHEN** `/api/health/live` is called
- **THEN** it SHALL return success if the application process can serve requests
- **AND** SHALL NOT call PostgreSQL or external providers

#### Scenario: Readiness

- **WHEN** `/api/health/ready` or compatibility `/api/health` is called
- **THEN** it SHALL return success only when bounded PostgreSQL and required local configuration/encryption checks pass
- **AND** SHALL return 503 on failure or timeout
- **AND** SHALL NOT make readiness depend on live external provider network calls

#### Scenario: Database connectivity check

- **WHEN** readiness checks PostgreSQL
- **THEN** the system SHALL execute a bounded simple query
- **AND** SHALL return 503 when it fails or times out without exposing sensitive connection details

#### Scenario: Email service validation

- **WHEN** readiness validates required email configuration
- **THEN** the system SHALL verify required local credentials and settings are present
- **AND** SHALL NOT make a live SMTP or provider network call

#### Scenario: Encryption key validation

- **WHEN** readiness validates encryption configuration
- **THEN** the system SHALL verify the required key format and perform bounded local cryptographic validation
- **AND** SHALL return 503 without logging secret key material when validation fails

#### Scenario: Readiness vs liveness

- **WHEN** `/api/health/live` is called
- **THEN** it SHALL report process-serving ability without dependency checks
- **WHEN** `/api/health/ready` is called
- **THEN** it SHALL report bounded required database and local configuration readiness

### Requirement: Database Schema Management

The system SHALL execute generated forward-compatible migrations exactly once per Railway deployment before application replicas start.

#### Scenario: Pre-deploy migration

- **WHEN** Railway deploys a revision
- **THEN** the pre-deploy command SHALL run the runtime Drizzle migrator using `DATABASE_URL`
- **AND** application `CMD` SHALL start only the built server
- **AND** migration failure SHALL prevent promotion

#### Scenario: Generated migration artifacts

- **WHEN** schema changes are introduced
- **THEN** `drizzle-kit generate` SHALL create SQL, snapshot, and journal entries
- **AND** generated migration files SHALL NOT be hand-authored or modified

#### Scenario: Migration execution

- **GIVEN** a generated forward-compatible migration is ready
- **WHEN** the Railway pre-deploy migrator applies it
- **THEN** Drizzle SHALL record the migration in its schema journal
- **AND** migration failure SHALL stop deployment before application replicas start

#### Scenario: Migration validation

- **WHEN** a migration is prepared for production
- **THEN** its generated artifacts SHALL pass migration smoke and staging validation
- **AND** the compatible code rollback and data-recovery procedure SHALL be documented and approved

#### Scenario: Rollback execution

- **GIVEN** an additive migration was applied and the new application revision fails
- **WHEN** rollback is initiated
- **THEN** the compatible prior application SHALL be restored without hand-reversing generated migrations
- **AND** destructive recovery, when required, SHALL use the documented backup-restore and data-integrity verification procedure

## ADDED Requirements

### Requirement: Fenced Durable Worker Leases

The system SHALL coordinate disclosure and export work through expiring PostgreSQL leases with random ownership IDs and fenced state transitions.

#### Scenario: Concurrent claim

- **WHEN** multiple replicas claim the same eligible work
- **THEN** only one lease owner SHALL be returned by the atomic claim statement

#### Scenario: Worker crash

- **WHEN** a lease expires before completion
- **THEN** another worker SHALL resume incomplete work
- **AND** a stale worker SHALL be unable to finalize using the old lease ID

### Requirement: Shared Export Artifact Storage

The system SHALL store bounded export artifacts in a durable shared store available to all replicas and SHALL never advertise a completed artifact that exists only on local ephemeral disk.

#### Scenario: Replica replacement

- **GIVEN** an export completed on one replica
- **WHEN** that replica terminates and another handles download
- **THEN** the authorized unexpired artifact SHALL remain available

### Requirement: Reproducible Gated Release

The system SHALL build with pinned Bun/action/base-image identities and SHALL prevent Railway production promotion until required CI checks and environment approval succeed for the exact source revision.

#### Scenario: Failing CI

- **WHEN** any required format, check, test, build, migration, Docker, or probe job fails
- **THEN** no production deployment SHALL be created for that revision

#### Scenario: Runtime image contents

- **WHEN** the production image is built
- **THEN** it SHALL run as non-root
- **AND** contain production runtime dependencies only, except explicitly required migration runtime
- **AND** expose the source revision and immutable image identity
