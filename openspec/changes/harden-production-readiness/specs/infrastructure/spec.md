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
