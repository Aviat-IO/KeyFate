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

### Requirement: Authenticated Recovery Material

The system SHALL protect new recovery material with a strict authenticated scheme that encrypts the secret under a fresh random content key, Shamir-splits only that key, and releases plaintext only after threshold, context, and AEAD authentication succeed.

#### Scenario: Authenticated v3 reconstruction

- **GIVEN** matching v3 share envelopes from one recovery set
- **WHEN** at least the declared threshold of distinct valid shares is supplied
- **THEN** the browser SHALL verify scheme, version, set ID, threshold, total, embedded indices, ciphertext, nonce, digest, and associated-data bindings before interpolation
- **AND** SHALL reconstruct exactly one 32-byte content key
- **AND** SHALL display plaintext only after AEAD authentication succeeds

#### Scenario: Tampered or mixed recovery material

- **WHEN** a v3 share, index, metadata field, ciphertext, nonce, digest, or recovery-set binding is missing, mixed, duplicated, or modified
- **THEN** recovery SHALL fail closed without displaying candidate plaintext
- **AND** SHALL NOT retry the input through a legacy parser

### Requirement: Shared Recipient Custody

New automated service/Nostr recovery SHALL use threshold 2 and SHALL encrypt the same logical recipient share separately for every recipient so recipient collusion does not accumulate distinct shares before disclosure.

#### Scenario: Multiple v3 recipients

- **GIVEN** an owner configures multiple recipients for a new v3 secret
- **WHEN** recipient artifacts are created
- **THEN** every recipient SHALL receive the same underlying non-service Shamir share with the same actual share index
- **AND** recipient-specific encryption and signatures SHALL bind that share independently to each recipient

#### Scenario: Unsupported higher threshold

- **WHEN** an owner attempts automated service/Nostr v3 enrollment with a threshold other than 2
- **THEN** creation SHALL fail before any secret or recovery artifact is persisted or published
- **AND** existing higher-threshold legacy material SHALL NOT be reinterpreted or downgraded

### Requirement: Recovery Material Transport Hygiene

The system SHALL NOT generate, consume, or support plaintext recovery shares in URLs, referrers, generated email URI bodies, logs, analytics, or cacheable recovery responses.

#### Scenario: Share-bearing recovery URL

- **WHEN** a recovery surface receives `share`, `share1`, or another share-bearing query parameter
- **THEN** the application SHALL ignore or reject the parameter without using it for reconstruction
- **AND** SHALL instruct the user to paste or import recovery material locally

#### Scenario: Recovery response policy

- **WHEN** a recovery or decrypt surface is served
- **THEN** the response SHALL use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`
- **AND** generated owner instructions SHALL NOT place plaintext shares in `mailto:` or other URI values

### Requirement: Explicit Legacy Recovery Isolation

Legacy raw or v2 recovery material SHALL be reconstructed only through a deliberate legacy mode that cannot be entered as fallback from failed v3 validation.

#### Scenario: Legacy interpolation

- **WHEN** a user explicitly selects legacy recovery and supplies legacy shares
- **THEN** the UI SHALL label the result as unverified interpolation rather than authenticated recovery
- **AND** SHALL warn that corruption, mixed sets, insufficient thresholds, and substitution cannot be detected

#### Scenario: V3 validation failure

- **WHEN** input appears to be v3 but fails any v3 validation or authentication check
- **THEN** recovery SHALL fail closed
- **AND** SHALL NOT offer automatic legacy interpretation of that input

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
