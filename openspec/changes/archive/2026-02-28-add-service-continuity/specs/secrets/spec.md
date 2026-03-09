## ADDED Requirements

### Requirement: Recovery Kit Export

Users SHALL be able to download a complete recovery kit containing all information needed to reconstruct their secret without KeyFate infrastructure.

#### Scenario: User exports recovery kit
- **WHEN** user clicks "Export Recovery Kit" on secret details page
- **THEN** system downloads a ZIP file containing:
  - Standalone recovery HTML tool
  - Decrypted server share
  - User-managed shares (if available in localStorage)
  - Secret metadata (title, threshold, total shares)
  - Recovery instructions

#### Scenario: Recipient uses recovery kit offline
- **WHEN** recipient opens recovery.html in a browser with no internet
- **AND** enters the required number of shares
- **THEN** the secret is reconstructed entirely client-side

### Requirement: Nostr Share Distribution

Users SHALL be able to publish encrypted shares to multiple Nostr relays for censorship-resistant storage.

#### Scenario: Share published to Nostr on secret creation
- **WHEN** user creates a new secret with Nostr backup enabled
- **THEN** encrypted shares are published to at least 3 configured Nostr relays
- **AND** share events use NIP-44 encryption to recipient's pubkey

#### Scenario: Recipient retrieves share from Nostr
- **WHEN** recipient queries configured Nostr relays with their pubkey
- **THEN** system returns encrypted share events for their secrets
- **AND** shares can be decrypted with recipient's private key

### Requirement: Decentralized Storage Backup

Pro users SHALL be able to store encrypted shares on permanent decentralized storage (IPFS/Arweave).

#### Scenario: Share uploaded to Arweave
- **WHEN** Pro user creates a secret with permanent storage enabled
- **THEN** encrypted share is uploaded to Arweave
- **AND** transaction ID is stored in secret metadata
- **AND** share is retrievable via `arweave.net/{txId}` indefinitely

#### Scenario: Share uploaded to IPFS
- **WHEN** user creates a secret with IPFS backup enabled
- **THEN** encrypted share is uploaded and pinned to IPFS
- **AND** CID is stored in secret metadata
- **AND** share is retrievable via any IPFS gateway

### Requirement: Automatic Disclosure Without KeyFate

The system SHALL support automatic secret disclosure even when KeyFate infrastructure is unavailable.

#### Scenario: Nostr oracle triggers disclosure
- **WHEN** user fails to check in before deadline
- **AND** KeyFate infrastructure is unavailable
- **THEN** independent Nostr oracle bots detect missed deadline
- **AND** oracle publishes disclosure event to Nostr relays
- **AND** recipients receive notification via Nostr

#### Scenario: Smart contract triggers disclosure
- **WHEN** user fails to check in before on-chain deadline
- **AND** KeyFate infrastructure is unavailable
- **THEN** Chainlink Automation calls disclosure function
- **AND** encrypted share reference is emitted as blockchain event
- **AND** recipients can retrieve share from decentralized storage

### Requirement: Bitcoin Timelock Disclosure (Optional)

The system SHALL provide an optional Bitcoin timelock-based disclosure mechanism for crypto-native users who choose to enable it.

#### Scenario: User creates timelocked transaction
- **WHEN** user enables Bitcoin timelock for a secret
- **THEN** system creates a pre-signed, timelocked transaction
- **AND** transaction includes OP_RETURN with encrypted share reference
- **AND** recipient receives signed transaction for later broadcast

#### Scenario: User checks in via Bitcoin
- **WHEN** user performs check-in before timelock expires
- **THEN** user spends the UTXO to a new address
- **AND** previous timelocked transaction becomes invalid
- **AND** new timelocked transaction is created with extended deadline

#### Scenario: Recipient broadcasts after timelock
- **WHEN** timelock period expires without UTXO being spent
- **THEN** recipient broadcasts the pre-signed transaction
- **AND** transaction is confirmed on Bitcoin network
- **AND** recipient retrieves share reference from OP_RETURN data
