## MODIFIED Requirements

### Requirement: Pre-Signed Recipient Transaction

The system SHALL create a complete delayed-branch transaction in the owner browser after the funding outpoint is known, sign it with a one-time branch key, and pay a network-valid address controlled by the actual recipient.

#### Scenario: Recipient transaction creation

- **WHEN** the owner provisions Bitcoin recovery
- **THEN** the transaction output SHALL pay the confirmed recipient address
- **AND** the OP_RETURN SHALL bind K and the canonical Nostr capsule event ID
- **AND** the one-time branch private key SHALL be destroyed after signing

#### Scenario: Successful pre-signed transaction

- **WHEN** the known timelock UTXO, one-time delayed-branch signing key, confirmed recipient address, and bound OP_RETURN data are provided
- **THEN** a complete serialized transaction with the delayed-branch witness SHALL be returned
- **AND** the transaction SHALL be recipient-usable without transmitting the branch private key

#### Scenario: UTXO too small for fees

- **WHEN** the timelock UTXO amount cannot cover the delayed transaction fee and valid recipient output
- **THEN** creation SHALL fail before destroying the one-time branch private key or reporting the generation ready

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

#### Scenario: Generate and store keypair

- **WHEN** owner and one-time branch key material is generated in the browser
- **THEN** only explicitly encrypted owner continuity material MAY be persisted beyond the active operation
- **AND** no recipient private key SHALL be generated or stored by the owner

#### Scenario: Retrieve stored keypair

- **WHEN** an owner resumes from a continuity kit
- **THEN** the browser SHALL authenticate and decrypt the exact generation-bound owner material locally
- **AND** SHALL NOT retrieve a plaintext private key from the service

#### Scenario: Clear session data

- **WHEN** Bitcoin session data is cleared or a one-time branch signature completes
- **THEN** transient plaintext key material and metadata SHALL be removed from browser storage to the extent supported by the runtime
- **AND** the durable encrypted continuity kit SHALL remain owner-controlled

### Requirement: UTXO Refresh (Check-In)

The system SHALL couple a service check-in to a recoverable Bitcoin generation transition and SHALL create and persist a complete new recovery generation before marking the previous generation superseded.

#### Scenario: Bitcoin-enabled service check-in

- **GIVEN** a secret has a current Bitcoin recovery generation
- **WHEN** the owner attempts an ordinary service check-in without refreshing that generation
- **THEN** the server SHALL reject the check-in
- **AND** SHALL advance the service deadline only in the atomic finalization of the next Bitcoin generation

#### Scenario: Recoverable transition ordering

- **WHEN** the owner prepares setup or refresh
- **THEN** the complete recipient-encrypted envelope and encrypted owner continuity kit SHALL exist before broadcast
- **AND** the server SHALL persist a prepared, non-ready transition before broadcast
- **AND** finalization SHALL verify the exact network, transaction ID, outpoint, amount, and script before advancing readiness or the service deadline

#### Scenario: Ambiguous broadcast or persistence failure

- **WHEN** broadcast is accepted but its response times out, final persistence fails, or the process stops between prepare and finalize
- **THEN** retry SHALL be idempotent for the same prepared transaction and generation
- **AND** the durable encrypted kit and prepared public state SHALL be sufficient to reconcile without the destroyed one-time branch key
- **AND** the server SHALL distinguish the prepared/ambiguous transition from both the prior generation and finalized readiness
- **AND** SHALL NOT falsely report the potentially spent prior outpoint or the partially provisioned next generation as ready

#### Scenario: Successful refresh

- **WHEN** the owner prepares, broadcasts, and finalizes a valid next generation using its encrypted continuity kit
- **THEN** the new transaction SHALL spend the current owner branch and create the verified next timelock output
- **AND** only exact-output finalization SHALL advance the service deadline and current generation

#### Scenario: UTXO depleted after fee

- **WHEN** the amount remaining after the refresh fee is below the configured minimum
- **THEN** preparation SHALL fail without advancing the deadline, superseding the current generation, or reporting a next generation ready

### Requirement: Server-Side Bitcoin UTXO Lifecycle

The server SHALL store only recipient-encrypted complete transaction envelopes and public lifecycle metadata and SHALL use generation fencing for updates.

#### Scenario: Prohibited private material

- **WHEN** a store/refresh request contains a private key, plaintext K, or plaintext pre-signed transaction
- **THEN** the server SHALL reject it

#### Scenario: Stale generation

- **WHEN** a client attempts to update a non-current generation
- **THEN** the server SHALL reject the update without superseding current recovery data

#### Scenario: Enable Bitcoin on a secret

- **WHEN** an owner registers a valid prepared Bitcoin generation
- **THEN** the server SHALL store its recipient-encrypted envelope and public metadata in a non-ready state
- **AND** SHALL mark it current only after exact broadcast finalization

#### Scenario: Duplicate enable rejected

- **WHEN** an owner attempts to enable Bitcoin while a current or prepared generation already exists
- **THEN** the server SHALL reject an unrelated duplicate while allowing idempotent retry of the exact prepared generation

#### Scenario: Refresh rotates UTXO atomically

- **WHEN** an exact next-generation transaction is finalized
- **THEN** current-generation advancement and prior-generation supersession SHALL occur atomically under generation fencing

#### Scenario: Query Bitcoin status

- **WHEN** an owner queries Bitcoin recovery status
- **THEN** the server SHALL return only public lifecycle metadata and opaque encrypted artifacts
- **AND** SHALL distinguish prepared, ambiguous, finalized, and superseded generations

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

#### Scenario: Successful Bitcoin recovery

- **WHEN** a recipient decrypts the current complete transaction envelope and all manifest and transaction validations succeed
- **THEN** the UI SHALL permit broadcast after CSV maturity and SHALL expose the bound Nostr recovery artifact for local share recovery

#### Scenario: Event not found on relays

- **WHEN** the exact Nostr event bound by the validated OP_RETURN and manifest cannot be found
- **THEN** the UI SHALL report that the bound event is unavailable
- **AND** SHALL NOT accept a different unbound event as a substitute
