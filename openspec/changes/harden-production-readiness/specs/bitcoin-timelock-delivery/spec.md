## MODIFIED Requirements

### Requirement: Pre-Signed Recipient Transaction

The system SHALL create a complete delayed-branch transaction in the owner browser after the funding outpoint is known, sign it with a one-time branch key, and pay a network-valid address controlled by the actual recipient.

#### Scenario: Recipient transaction creation

- **WHEN** the owner provisions Bitcoin recovery
- **THEN** the transaction output SHALL pay the confirmed recipient address
- **AND** the OP_RETURN SHALL bind K and the canonical Nostr capsule event ID
- **AND** the one-time branch private key SHALL be destroyed after signing

### Requirement: Client-Side Bitcoin Key Management

The system SHALL keep all Bitcoin private keys client-side, SHALL NOT generate/store a recipient wallet private key in the owner's browser, and SHALL not rely on sessionStorage as the only copy of owner refresh continuity material.

#### Scenario: Recipient custody

- **WHEN** Bitcoin recovery is configured
- **THEN** the system SHALL store only the recipient's public address and confirmation metadata
- **AND** the recipient SHALL retain control of the corresponding wallet key

#### Scenario: Owner continuity

- **WHEN** owner refresh material is created
- **THEN** it SHALL be available through an explicit encrypted owner-controlled continuity kit
- **AND** SHALL NOT be uploaded in plaintext

### Requirement: UTXO Refresh (Check-In)

The system SHALL create and persist a complete new recovery generation before marking the previous generation superseded.

#### Scenario: Refresh failure

- **WHEN** signing, publication, encryption, broadcast, or persistence of the new generation fails
- **THEN** the prior generation SHALL remain current
- **AND** no partially provisioned generation SHALL be reported as ready

### Requirement: Server-Side Bitcoin UTXO Lifecycle

The server SHALL store only recipient-encrypted complete transaction envelopes and public lifecycle metadata and SHALL use generation fencing for updates.

#### Scenario: Prohibited private material

- **WHEN** a store/refresh request contains a private key, plaintext K, or plaintext pre-signed transaction
- **THEN** the server SHALL reject it

#### Scenario: Stale generation

- **WHEN** a client attempts to update a non-current generation
- **THEN** the server SHALL reject the update without superseding current recovery data

### Requirement: Bitcoin Recovery UI

The system SHALL allow the recipient to obtain and locally decrypt the current complete delayed transaction, validate it against the expected recovery manifest, and broadcast it after CSV maturity.

#### Scenario: Local validation

- **WHEN** a recipient decrypts a transaction envelope
- **THEN** the UI SHALL verify network, current input outpoint, sequence, witness script, OP_RETURN capsule binding, and recipient payment output/address before broadcast

#### Scenario: Browser restart

- **GIVEN** the owner browser session that created the transaction no longer exists
- **WHEN** the recipient performs recovery
- **THEN** recovery SHALL require no owner or server private key

#### Scenario: Production enablement

- **WHEN** Bitcoin recovery has not passed the signet funding, maturity, broadcast, recipient-spend, refresh, and restart E2E
- **THEN** the UI SHALL remain disabled and SHALL NOT claim Bitcoin recovery is ready
