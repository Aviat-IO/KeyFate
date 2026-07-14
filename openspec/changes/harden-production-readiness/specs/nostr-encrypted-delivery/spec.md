## MODIFIED Requirements

### Requirement: NIP-59 Gift Wrap Event Construction

The system SHALL construct and sign NIP-59 gift wraps in the owner browser and bind them to the expected recipient, owner publisher identity, recovery context, and versioned capsule event.

#### Scenario: Client-created gift wrap

- **WHEN** a recipient recovery capsule is published
- **THEN** the owner browser SHALL sign the seal and outer gift wrap
- **AND** the service SHALL NOT possess the publisher secret key or plaintext recipient share

### Requirement: Double Encryption of Shares

The system SHALL double-encrypt recipient shares entirely in the owner browser using a random 32-byte K and recipient NIP-44 encryption.

#### Scenario: V2 capsule encryption

- **WHEN** a recipient share is prepared
- **THEN** the result SHALL include `encryptedShareHex`, `nonceHex`, and `encryptedKNostr`
- **AND** neither the plaintext share nor K SHALL be transmitted to KeyFate

### Requirement: Nostr Share Publishing Service

The system SHALL publish owner-signed opaque v2 recovery artifacts directly from the browser or relay only an already-signed validated event.

#### Scenario: Plaintext publication request

- **WHEN** a request includes a plaintext share, K, passphrase, or unsigned capsule
- **THEN** the service SHALL reject it

#### Scenario: Opaque event relay

- **WHEN** an authenticated owner submits an already-signed event for relay
- **THEN** the service SHALL verify ownership, event signature, publisher binding, kind, and strict schema before relaying unchanged

### Requirement: K Recovery via Nostr (NIP-44)

The system SHALL recover K in the recipient browser from the capsule's `encryptedKNostr` after verifying the complete event chain and expected sender/recipient bindings. K MUST be exactly 32 bytes.

#### Scenario: Invalid event chain

- **WHEN** any outer, seal, rumor, capsule, publisher, recipient, secret, or scheme binding is invalid
- **THEN** recovery SHALL fail before decrypting or accepting a share

### Requirement: Nostr Recovery UI

The system SHALL unwrap and verify v2 recovery artifacts, parse the canonical capsule schema, recover K from `encryptedKNostr`, and decrypt the share using the capsule's nonce entirely in the browser.

#### Scenario: Successful v2 recovery

- **WHEN** the recipient supplies the correct nsec and selects a valid bound artifact
- **THEN** the UI SHALL verify every event layer
- **AND** recover K and the share without manual nonce or separate K-bundle entry

#### Scenario: Legacy artifact

- **WHEN** a v1 or unbound artifact is selected
- **THEN** the UI SHALL NOT interpret it as v2
- **AND** SHALL require the documented legacy path or owner re-enrollment
