## ADDED Requirements

### Requirement: Durable Work Lease Monitoring

The system SHALL expose and alert on durable disclosure/export lease health and stale-work recovery.

#### Scenario: Expired disclosure lease

- **WHEN** a disclosure lease expires before terminal recipient outcomes are committed
- **THEN** the system SHALL record a stale-work recovery event
- **AND** SHALL make the work eligible for a fenced takeover
- **AND** SHALL alert if recovery repeatedly fails

#### Scenario: Stale worker write

- **WHEN** a worker attempts to update work using a superseded lease ID
- **THEN** the update SHALL affect zero rows
- **AND** the system SHALL record a lost-ownership metric without marking work complete

### Requirement: Recovery Readiness Monitoring

The system SHALL report counts of ready, legacy-re-enrollment-required, failed, and incomplete Nostr/Bitcoin recovery configurations.

#### Scenario: Launch readiness

- **WHEN** production readiness is evaluated
- **THEN** all launch-required recovery paths SHALL have successful credentialed end-to-end evidence
- **AND** legacy/incomplete records SHALL be visible rather than counted as ready

### Requirement: Release Provenance Monitoring

The system SHALL expose the deployed source revision and record deployment, migration, readiness, rollback, and approval events.

#### Scenario: Deployment verification

- **WHEN** a revision is promoted
- **THEN** maintainers SHALL be able to correlate the running revision to the green CI result, image digest, migration result, and approval
