## ADDED Requirements

### Requirement: Decentralized Secret Disclosure via Bitcoin Timelocks

The system SHALL support opt-in Bitcoin CSV timelock-based disclosure as a
Pro-tier feature. When enabled, a Bitcoin UTXO SHALL be created with a script
that allows the owner to spend at any time (check-in) or the recipient to spend
after a configurable timeout period. The pre-signed recipient transaction SHALL
contain an OP_RETURN output with a pointer to the encrypted share on Nostr
relays and the symmetric decryption key.

#### Scenario: Bitcoin-enabled secret creation

- **WHEN** a Pro user creates a secret with Bitcoin timelock enabled
- **THEN** the system SHALL create a CSV-timelocked UTXO on the Bitcoin network
- **AND** pre-sign a recipient transaction with OP_RETURN containing the Nostr
  event pointer and encrypted symmetric key K
- **AND** store the UTXO details in the database for tracking

#### Scenario: Check-in refreshes Bitcoin timelock

- **WHEN** a user checks in on a Bitcoin-enabled secret
- **THEN** the system SHALL spend the existing UTXO via the owner path
- **AND** create a new UTXO with the same CSV timelock script
- **AND** generate a new pre-signed recipient transaction
- **AND** the previous pre-signed transaction SHALL become invalid (UTXO already
  spent)

#### Scenario: Timeout triggers recipient spending path

- **WHEN** the CSV timelock expires because the user did not check in
- **THEN** the recipient SHALL be able to broadcast the pre-signed transaction
- **AND** the OP_RETURN data SHALL be recorded on-chain
- **AND** the recipient SHALL extract the Nostr event pointer and symmetric key
  K from the OP_RETURN

### Requirement: Nostr-Based Encrypted Share Storage

The system SHALL publish encrypted shares to multiple Nostr relays using NIP-59
Gift Wrap for metadata privacy. Shares SHALL be encrypted using a double
encryption scheme: first with a random symmetric key K (ChaCha20-Poly1305), then
wrapped with the recipient's Nostr public key (NIP-44).

#### Scenario: Share published to Nostr on secret creation

- **WHEN** a user creates a secret with Nostr disclosure enabled
- **THEN** the system SHALL encrypt the server share with a random symmetric key
  K using ChaCha20-Poly1305
- **AND** wrap the encrypted share in a NIP-59 Gift Wrap event addressed to the
  recipient's Nostr pubkey
- **AND** publish the event to at least 5 recommended relays
- **AND** store the Nostr event ID for reference

#### Scenario: Recipient retrieves share from Nostr

- **WHEN** a recipient queries Nostr relays for Gift Wrapped events addressed to
  their pubkey
- **THEN** they SHALL receive the encrypted share event
- **AND** they SHALL decrypt the outer layers with their Nostr private key
  (NIP-44)
- **AND** they SHALL decrypt the inner share using key K (obtained from Bitcoin
  OP_RETURN or passphrase)

### Requirement: Quantum-Resistant Encryption

The system SHALL use a double encryption scheme that remains secure against
quantum computing attacks on elliptic curve cryptography. The symmetric
encryption layer (ChaCha20-Poly1305 with 256-bit key) SHALL provide quantum-safe
protection independent of the NIP-44 ECDH layer.

#### Scenario: Quantum-safe recovery path

- **WHEN** a recipient has access to the symmetric key K (from Bitcoin OP_RETURN
  or pre-shared passphrase)
- **THEN** they SHALL be able to decrypt the share without using NIP-44 ECDH
- **AND** the decryption SHALL remain secure even if secp256k1 is broken by
  quantum computers

#### Scenario: Optional passphrase backup for K

- **WHEN** a user enables passphrase-based backup for the symmetric key K
- **THEN** the system SHALL derive an encryption key from the passphrase using
  PBKDF2
- **AND** encrypt K with AES-256-GCM using the derived key
- **AND** store the passphrase-encrypted K alongside the NIP-44-encrypted K

### Requirement: Recipient Recovery Without KeyFate

The system SHALL provide a standalone recovery page that allows recipients to
reconstruct secrets using only Nostr relays and Bitcoin transaction data,
without requiring KeyFate's servers to be operational.

#### Scenario: Recovery via Nostr + Bitcoin (server down)

- **WHEN** KeyFate is unavailable and a Bitcoin timelock has expired
- **THEN** the recipient SHALL navigate to the recovery page (cached or hosted
  elsewhere)
- **AND** broadcast the pre-signed Bitcoin transaction to extract K and the
  Nostr event pointer from OP_RETURN
- **AND** query Nostr relays for the encrypted share using the event pointer
- **AND** decrypt the share with K
- **AND** combine with their own share(s) to reconstruct the secret

#### Scenario: Recovery via passphrase (no Bitcoin)

- **WHEN** a recipient has the passphrase-encrypted K and access to Nostr relays
- **THEN** they SHALL enter the passphrase to derive K
- **AND** retrieve and decrypt the share from Nostr
- **AND** combine with their own share(s) to reconstruct the secret
