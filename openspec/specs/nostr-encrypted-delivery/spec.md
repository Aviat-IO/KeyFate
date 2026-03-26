# nostr-encrypted-delivery Specification

## Purpose
TBD - created by archiving change add-nostr-encrypted-delivery. Update Purpose after archive.
## Requirements
### Requirement: NIP-44 Encryption and Decryption

The system SHALL provide NIP-44 v2 encryption and decryption using conversation keys derived from a sender's private key and a recipient's public key via secp256k1 ECDH. The conversation key derivation MUST be symmetric: `conversationKey(a, B) === conversationKey(b, A)`.

#### Scenario: Encrypt and decrypt round-trip

- **WHEN** a plaintext string is encrypted with a conversation key derived from sender privkey and recipient pubkey
- **THEN** decrypting the payload with the conversation key derived from recipient privkey and sender pubkey SHALL return the original plaintext

#### Scenario: Wrong key fails decryption

- **WHEN** a NIP-44 payload is decrypted with an incorrect conversation key
- **THEN** the system SHALL throw an error (MAC check failure)

### Requirement: Nostr Keypair Generation and Encoding

The system SHALL generate Nostr keypairs using `nostr-tools` and provide NIP-19 encoding/decoding for human-friendly key representations. The system MUST support npub (bech32 public key) and nsec (bech32 secret key) formats, hex pubkey validation (64 lowercase hex characters), and npub validation.

#### Scenario: Generate keypair

- **WHEN** a new keypair is generated
- **THEN** it SHALL contain a 32-byte secret key, hex public key, npub string, and nsec string

#### Scenario: npub to hex conversion

- **WHEN** a valid npub string is provided
- **THEN** the system SHALL return the corresponding 64-character hex public key

#### Scenario: Invalid npub rejected

- **WHEN** an invalid npub string is validated
- **THEN** `isValidNpub` SHALL return false

### Requirement: Relay Pool Management

The system SHALL manage connections to a configurable set of Nostr relays via a pool wrapper. The default relay list MUST contain at least 10 well-known relays. Publishing an event MUST attempt all configured relays and succeed if at least one relay accepts. A warning SHALL be logged if fewer than 3 relays accept the event.

#### Scenario: Publish to all relays

- **WHEN** an event is published
- **THEN** the system SHALL attempt all configured relays via `Promise.allSettled`

#### Scenario: All relays reject

- **WHEN** no relay accepts the published event
- **THEN** the system SHALL throw an error

#### Scenario: Below minimum threshold

- **WHEN** fewer than 3 relays accept the event but at least 1 does
- **THEN** the system SHALL log a warning but NOT throw an error

### Requirement: Relay Health Checking

The system SHALL check relay health by opening a WebSocket connection with a 5-second timeout. The system MUST support checking individual relays and bulk-checking all relays, returning only healthy relays sorted by latency (fastest first).

#### Scenario: Healthy relay

- **WHEN** a relay WebSocket connection opens within 5 seconds
- **THEN** the relay SHALL be reported as healthy with its latency in milliseconds

#### Scenario: Unreachable relay

- **WHEN** a relay WebSocket connection fails or times out
- **THEN** the relay SHALL be reported as unhealthy with null latency

### Requirement: NIP-59 Gift Wrap Event Construction

The system SHALL construct three-layer NIP-59 gift-wrapped events for share delivery:
1. A **rumor** (unsigned event, custom kind 21059) containing the share payload as JSON
2. A **seal** (kind 13, signed by the real author) encrypting the rumor to the recipient via NIP-44
3. A **gift wrap** (kind 1059, signed by an ephemeral throwaway key) encrypting the seal to the recipient via NIP-44, with a `p` tag identifying the recipient

Seal and gift wrap timestamps MUST be randomized within a 2-day window to prevent timing analysis.

#### Scenario: Full gift wrap pipeline

- **WHEN** a share payload, sender secret key, and recipient public key are provided
- **THEN** the system SHALL return a signed kind-1059 event with a `p` tag for the recipient, an ephemeral sender pubkey, and double-encrypted content

#### Scenario: Rumor contains share metadata

- **WHEN** a rumor is created
- **THEN** its content SHALL be a JSON-serialized SharePayload containing share, secretId, shareIndex, threshold, totalShares, and version fields

#### Scenario: Timestamp randomization

- **WHEN** seal and gift wrap events are created
- **THEN** their `created_at` timestamps SHALL be random values within the last 2 days, NOT the current time

### Requirement: Double Encryption of Shares

The system SHALL double-encrypt Shamir shares to provide three independent recovery paths for the symmetric key K:
1. Generate a random 32-byte symmetric key K
2. Encrypt the share with K using ChaCha20-Poly1305 (quantum-safe)
3. Encrypt K via NIP-44 for Nostr-based recovery (convenient, NOT quantum-safe)
4. Optionally encrypt K via PBKDF2-SHA256 + AES-256-GCM for passphrase recovery (quantum-safe)
5. Return plaintext K for Bitcoin OP_RETURN embedding (quantum-safe, trustless)

#### Scenario: Double encrypt with passphrase

- **WHEN** a share, recipient Nostr pubkey, sender Nostr privkey, and passphrase are provided
- **THEN** the result SHALL contain encryptedShare, nonce, encryptedKNostr, encryptedKPassphrase (with ciphertext, nonce, salt), and plaintextK

#### Scenario: Double encrypt without passphrase

- **WHEN** no passphrase is provided
- **THEN** encryptedKPassphrase SHALL be undefined, but encryptedKNostr and plaintextK SHALL still be present

### Requirement: Nostr Share Publishing Service

The system SHALL publish double-encrypted Shamir shares to Nostr relays for recipients that have a `nostrPubkey`. For each eligible recipient, the system MUST: (1) double-encrypt the share, (2) create a NIP-59 gift wrap event, (3) publish to relays. Recipients without a nostrPubkey SHALL be skipped. The service MUST return the list of published event IDs, skipped recipient IDs, and any per-recipient errors.

#### Scenario: Publish to eligible recipients

- **WHEN** shares are published for a set of recipients where some have nostrPubkeys
- **THEN** eligible recipients SHALL receive gift-wrapped events and ineligible recipients SHALL be listed as skipped

#### Scenario: Individual recipient failure

- **WHEN** publishing fails for one recipient but succeeds for others
- **THEN** the failure SHALL be recorded in the errors array and other recipients SHALL not be affected

#### Scenario: Relay connection cleanup

- **WHEN** publishing is complete (success or failure)
- **THEN** the Nostr client relay connections SHALL be closed

### Requirement: Recipient Nostr Public Key Storage

The system SHALL store an optional Nostr public key (`nostr_pubkey`) for each recipient in the database. The field MUST be nullable text to support recipients who do not use Nostr.

#### Scenario: Recipient with Nostr pubkey

- **WHEN** a recipient has a nostrPubkey set
- **THEN** the system SHALL use it for Nostr share delivery

#### Scenario: Recipient without Nostr pubkey

- **WHEN** a recipient has no nostrPubkey
- **THEN** the system SHALL skip Nostr delivery for that recipient

### Requirement: K Recovery via Nostr (NIP-44)

The system SHALL recover the symmetric key K by decrypting the NIP-44-encrypted K payload using the recipient's Nostr private key and the sender's public key. The recovered K MUST be exactly 32 bytes.

#### Scenario: Successful K recovery

- **WHEN** a valid NIP-44 encrypted K, recipient privkey, and sender pubkey are provided
- **THEN** a 32-byte symmetric key K SHALL be returned

#### Scenario: Invalid K length

- **WHEN** the decrypted K is not 32 bytes
- **THEN** the system SHALL throw an error

### Requirement: Nostr Recovery UI

The system SHALL provide a client-side Nostr recovery step that allows recipients to: (1) enter their nsec private key, (2) search configured relays for gift-wrapped events (kind 1059) tagged with their pubkey, (3) select and unwrap events to extract the double-encrypted shares, (4) choose a K-recovery method (passphrase or OP_RETURN), (5) decrypt the shares with the recovered K. All operations MUST execute entirely in the browser. The nsec input MUST support visibility toggling and SHALL never be transmitted.

#### Scenario: Search and find events

- **WHEN** a valid nsec is entered and relays are searched
- **THEN** all kind-1059 events with a matching p-tag SHALL be listed with their timestamps

#### Scenario: Unwrap and decrypt share

- **WHEN** selected events are unwrapped and K is recovered (via passphrase or OP_RETURN)
- **THEN** the decrypted share plaintext SHALL be displayed

#### Scenario: No events found

- **WHEN** no gift-wrapped events exist for the given pubkey on any relay
- **THEN** the system SHALL display an informational message

