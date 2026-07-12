## ADDED Requirements

### Requirement: Recovery Share Custody Boundary

The system SHALL ensure the KeyFate service trust domain never receives, stores, or can decrypt enough Shamir shares to meet a secret's configured threshold.

#### Scenario: Default Nostr-enabled creation

- **GIVEN** a browser creates a 2-of-3 secret
- **WHEN** the service share and recipient recovery share are provisioned
- **THEN** only the single service share SHALL be transmitted in plaintext-equivalent form to KeyFate
- **AND** the recipient share and its symmetric key SHALL be encrypted and signed in the browser
- **AND** no server request SHALL contain another plaintext share or opening key

#### Scenario: Generic decryption request

- **WHEN** a client attempts to submit an arbitrary ciphertext tuple for server decryption
- **THEN** no generic decryption endpoint SHALL be available
- **AND** decryption SHALL occur only inside a purpose-bound server workflow with explicit object authorization

#### Scenario: Legacy recovery record

- **GIVEN** a legacy record cannot prove the custody boundary
- **WHEN** its owner or recipient views recovery readiness
- **THEN** the system SHALL mark it as requiring re-enrollment
- **AND** SHALL NOT claim that recovery is ready

### Requirement: Purpose-Bound Recovery Capability

The system SHALL store only a one-way verifier for a recovery capability and SHALL bind each capability to one secret, purpose, expiry, and atomic consumption state.

#### Scenario: Database read compromise

- **GIVEN** an attacker can read recovery capability rows and encrypted server shares
- **WHEN** the attacker calls a public recovery endpoint without the original capability
- **THEN** the system SHALL NOT return or decrypt the server share

### Requirement: Durable GDPR Export Artifact

The system SHALL create bounded, shared, expiring export artifacts that are available to every application replica without storing them on a replica-local filesystem.

#### Scenario: Authorized download

- **GIVEN** a completed unexpired export belongs to the authenticated user
- **WHEN** the user downloads it
- **THEN** the system SHALL atomically enforce the download limit
- **AND** return the integrity-checked artifact with attachment and no-store headers

#### Scenario: Expired or cross-user download

- **WHEN** a user requests another user's export or an expired/incomplete artifact
- **THEN** the system SHALL deny the download without incrementing its count
