## MODIFIED Requirements

### Requirement: NIP-59 Gift Wrap Event Construction

The system SHALL construct and sign strict v3 NIP-59 gift wraps in the owner browser and bind them to the expected recipient, independently pinned owner publisher identity, secret and recovery-set context, shared recipient index, protected-secret digest, and versioned capsule event.

#### Scenario: Client-created gift wrap

- **WHEN** a recipient recovery capsule is published
- **THEN** the owner browser SHALL sign the capsule, seal, outer gift wrap, and setup-bundle manifest with one per-secret publisher key
- **AND** the service SHALL NOT possess the publisher secret key, plaintext recipient share, or reconstructed content key

#### Scenario: Disclosure-time publisher substitution

- **GIVEN** the recipient retained the owner-delivered setup bundle before disclosure
- **WHEN** KeyFate or another party supplies a self-signed manifest under a different publisher
- **THEN** recovery SHALL reject it before decrypting or accepting a share

#### Scenario: Full gift wrap pipeline

- **WHEN** a v3 share envelope, publisher secret key, and recipient public key are provided
- **THEN** the system SHALL return a signed kind-1059 event with the exact recipient tag, ephemeral outer publisher, and encrypted signed capsule chain bound to the setup bundle

#### Scenario: Rumor contains share metadata

- **WHEN** a v3 rumor is created
- **THEN** it SHALL bind the recipient, secret, recovery-set identifier, actual shared recipient index, threshold, total, ciphertext digest, capsule ID, and scheme version without exposing the plaintext share envelope

#### Scenario: Timestamp randomization

- **WHEN** seal and gift wrap events are created
- **THEN** their `created_at` timestamps SHALL be randomized within the protocol window rather than reveal the exact publication time

### Requirement: Double Encryption of Shares

The system SHALL encrypt each recipient's v3 share envelope entirely in the owner browser using a fresh random 32-byte transport key and recipient NIP-44 encryption.

#### Scenario: V3 capsule encryption

- **WHEN** the shared logical recipient share is prepared for one recipient
- **THEN** the result SHALL include authenticated share-envelope ciphertext, nonce, and recipient-encrypted transport key
- **AND** neither the plaintext share envelope nor transport/content key SHALL be transmitted to KeyFate

#### Scenario: Double encrypt with passphrase

- **WHEN** an optional passphrase recovery path is enabled for a v3 share envelope
- **THEN** the transport key SHALL be independently protected by the documented password-based authenticated-encryption scheme
- **AND** the protected result SHALL remain bound to the same recipient, secret, set, and ciphertext context

#### Scenario: Double encrypt without passphrase

- **WHEN** no passphrase is provided
- **THEN** recipient NIP-44 protection SHALL remain present
- **AND** no passphrase-protected transport-key artifact SHALL be emitted

### Requirement: Nostr Share Publishing Service

The system SHALL publish owner-signed opaque v3 recovery artifacts directly from the browser or relay only an already-signed validated event.

#### Scenario: Plaintext publication request

- **WHEN** a request includes a plaintext share, K, passphrase, or unsigned capsule
- **THEN** the service SHALL reject it

#### Scenario: Opaque event relay

- **WHEN** an authenticated owner submits an already-signed event for registration or relay
- **THEN** the service SHALL verify ownership, event signature, consistent publisher, recipient, secret, set, share, ciphertext, kind, and strict v3 schema before relaying unchanged
- **AND** SHALL keep the secret paused until a separate protected setup-bundle finalization succeeds

#### Scenario: Publish to eligible recipients

- **WHEN** the shared logical recipient share is published for recipients with valid Nostr public keys
- **THEN** each recipient SHALL receive a separately encrypted and recipient-bound artifact for the same underlying Shamir index

#### Scenario: Individual recipient failure

- **WHEN** publication or bundle creation fails for any required recipient
- **THEN** enrollment SHALL remain paused and SHALL NOT be finalized for a partial recipient set

#### Scenario: Relay connection cleanup

- **WHEN** publication completes or fails
- **THEN** browser and optional server relay connections SHALL be closed without clearing the retained setup artifacts needed for safe retry

### Requirement: K Recovery via Nostr (NIP-44)

The system SHALL recover the 32-byte transport key in the recipient browser only after importing the retained owner-delivered setup bundle and verifying the complete event chain against its pinned publisher, recipient, secret, set, share, ciphertext, and scheme bindings.

#### Scenario: Invalid event chain or trust anchor

- **WHEN** the setup bundle is absent or any outer, seal, rumor, capsule, publisher, recipient, secret, set, share, ciphertext, or scheme binding is invalid
- **THEN** recovery SHALL fail before decrypting or accepting a share envelope
- **AND** SHALL NOT trust a replacement manifest supplied only through the disclosure channel

#### Scenario: Successful K recovery

- **WHEN** the retained setup bundle, valid NIP-44 transport-key ciphertext, matching recipient private key, and pinned publisher are provided
- **THEN** the browser SHALL return exactly one 32-byte transport key bound to the v3 recovery context

#### Scenario: Invalid K length

- **WHEN** the decrypted transport key is not exactly 32 bytes
- **THEN** recovery SHALL fail before attempting share-envelope decryption

### Requirement: Nostr Recovery UI

The system SHALL import and verify the owner-delivered v3 setup bundle, unwrap the bound Nostr artifact, recover the transport key, and decrypt the authenticated share envelope entirely in the browser.

#### Scenario: Successful v3 recovery

- **WHEN** the recipient imports the retained setup bundle, supplies the matching nsec, and selects the bound artifact
- **THEN** the UI SHALL verify every setup-bundle and event-layer binding against the pinned publisher
- **AND** recover the shared recipient envelope without trusting disclosure-time manifest replacement

#### Scenario: Missing setup bundle

- **WHEN** a recipient attempts v3 recovery without the retained setup bundle
- **THEN** the UI SHALL fail closed and explain that authenticated recovery requires the owner-delivered bundle
- **AND** SHALL NOT substitute a server-delivered publisher identity

#### Scenario: Legacy artifact

- **WHEN** a v1, v2, raw, or unbound artifact is selected
- **THEN** the UI SHALL NOT interpret it as v3
- **AND** SHALL require deliberate unverified legacy mode or owner re-enrollment

#### Scenario: Search and find events

- **WHEN** a valid setup bundle and matching nsec are supplied
- **THEN** the UI SHALL query configured relays only for the exact gift-wrap ID and recipient binding pinned by the bundle

#### Scenario: Unwrap and decrypt share

- **WHEN** the exact pinned event chain is found and every v3 binding verifies
- **THEN** the browser SHALL decrypt and return the authenticated recipient share envelope without displaying secret plaintext prematurely

#### Scenario: No events found

- **WHEN** the exact pinned gift wrap cannot be found on configured relays
- **THEN** the UI SHALL report that the authenticated artifact is unavailable and permit retry or alternate configured relays without accepting an unpinned substitute

### Requirement: Recipient Setup Bundle Finalization

The system SHALL keep new v3 recovery enrollment paused until the owner confirms that every recipient setup bundle was downloaded and distributed through an owner-controlled channel.

#### Scenario: Register before bundle distribution

- **WHEN** the owner registers valid signed v3 artifacts
- **THEN** the system SHALL store only their opaque public bindings
- **AND** SHALL NOT activate the secret, mark recovery ready, or schedule reminders

#### Scenario: Finalize bundle distribution

- **GIVEN** all v3 artifacts are registered and the owner has downloaded/distributed every recipient setup bundle
- **WHEN** the authenticated owner submits an idempotent CSRF-protected finalization
- **THEN** the system SHALL mark Nostr recovery ready, activate the secret when no other enrollment is pending, and schedule reminders exactly once
