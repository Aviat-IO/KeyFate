# bitcoin-timelock-delivery Specification

## Purpose
TBD - created by archiving change add-bitcoin-timelock-delivery. Update Purpose after archive.
## Requirements
### Requirement: CSV Timelock Script Construction

The system SHALL construct Bitcoin P2WSH scripts using OP_CHECKSEQUENCEVERIFY (CSV) that encode a two-branch spending policy: an owner branch (OP_IF) allowing immediate spending with the owner's signature, and a recipient branch (OP_ELSE) allowing spending after a relative timelock of `ttlBlocks` confirmations with the recipient's signature.

The system SHALL enforce that public keys are 33-byte compressed secp256k1 keys, that `ttlBlocks` is an integer between 1 and 65535, and that the maximum timelock duration is approximately 455 days (65535 blocks at 144 blocks/day).

#### Scenario: Valid script creation

- **WHEN** an owner pubkey (33 bytes), recipient pubkey (33 bytes), and ttlBlocks (1-65535) are provided
- **THEN** a valid Bitcoin script is returned encoding OP_IF <owner_pubkey> OP_CHECKSIG OP_ELSE <ttl> OP_CSV OP_DROP <recipient_pubkey> OP_CHECKSIG OP_ENDIF

#### Scenario: Script round-trip decode

- **WHEN** a CSV timelock script is created and then decoded
- **THEN** the decoded owner pubkey, recipient pubkey, and ttlBlocks MUST match the original inputs

#### Scenario: Invalid pubkey length rejected

- **WHEN** a pubkey that is not exactly 33 bytes is provided
- **THEN** the system SHALL throw an error indicating the expected length

#### Scenario: TTL blocks exceeds maximum

- **WHEN** a duration exceeding 65535 blocks is requested via `daysToBlocks`
- **THEN** the system SHALL throw an error indicating the maximum CSV value

### Requirement: P2WSH Address and Output Script Generation

The system SHALL generate P2WSH (Pay-to-Witness-Script-Hash) bech32 addresses and output scripts from witness scripts for both mainnet and testnet Bitcoin networks.

#### Scenario: Generate P2WSH address from timelock script

- **WHEN** a valid witness script and network are provided
- **THEN** a bech32 P2WSH address (bc1q... for mainnet, tb1q... for testnet) SHALL be returned

### Requirement: OP_RETURN Payload Construction

The system SHALL construct OP_RETURN scripts embedding a 64-byte payload consisting of a 32-byte symmetric key K followed by a 32-byte Nostr event ID. The OP_RETURN data MUST NOT exceed 80 bytes (Bitcoin standard relay policy).

#### Scenario: Valid OP_RETURN payload

- **WHEN** a 32-byte symmetric key and a 64-character hex Nostr event ID are provided
- **THEN** a 64-byte payload SHALL be constructed with K in bytes 0-31 and the event ID in bytes 32-63

#### Scenario: Oversized OP_RETURN rejected

- **WHEN** OP_RETURN data exceeds 80 bytes
- **THEN** the system SHALL throw an error

### Requirement: Timelock UTXO Transaction Creation

The system SHALL create Bitcoin transactions that fund a P2WSH output containing the CSV timelock script. The transaction MUST spend a P2WPKH funding input signed by the owner, create the timelock output, and return change to the owner if above the dust threshold (546 sats). The UTXO amount MUST be at least 10,000 satoshis.

#### Scenario: Successful timelock UTXO creation

- **WHEN** valid owner keys, recipient pubkey, funding UTXO, amount, and fee rate are provided
- **THEN** a signed transaction hex, transaction ID, output index, and timelock script SHALL be returned

#### Scenario: Insufficient funds

- **WHEN** the funding UTXO amount is less than the timelock amount plus estimated fee
- **THEN** the system SHALL throw an error indicating insufficient funds

#### Scenario: Amount below minimum

- **WHEN** the requested UTXO amount is below 10,000 satoshis
- **THEN** the system SHALL throw an error

### Requirement: Pre-Signed Recipient Transaction

The system SHALL create a pre-signed Bitcoin transaction that spends the timelock UTXO via the recipient (ELSE) branch. The transaction MUST set the input sequence to `ttlBlocks` for CSV enforcement, include an OP_RETURN output with the encrypted K and Nostr event ID, and send remaining funds to the recipient's address. The transaction becomes valid only after `ttlBlocks` confirmations of the timelock UTXO.

#### Scenario: Successful pre-signed transaction

- **WHEN** a timelock UTXO, recipient private key, recipient address, and OP_RETURN data are provided
- **THEN** a serialized transaction hex with witness data [<sig>, <FALSE>, <witnessScript>] SHALL be returned

#### Scenario: UTXO too small for fees

- **WHEN** the timelock UTXO amount is insufficient to cover the recipient transaction fee
- **THEN** the system SHALL throw an error

### Requirement: Transaction Broadcasting

The system SHALL broadcast signed Bitcoin transactions to the network using mempool.space as the primary endpoint and blockstream.info as a fallback. At least one endpoint MUST accept the transaction for success. Both mainnet and testnet MUST be supported.

#### Scenario: Successful broadcast via primary

- **WHEN** a valid signed transaction is broadcast and mempool.space accepts it
- **THEN** the transaction ID SHALL be returned

#### Scenario: Primary fails, fallback succeeds

- **WHEN** mempool.space rejects the transaction but blockstream.info accepts it
- **THEN** the transaction ID from blockstream.info SHALL be returned

#### Scenario: All endpoints fail

- **WHEN** all broadcast endpoints reject the transaction
- **THEN** the system SHALL throw an error listing all endpoint failures

### Requirement: UTXO Status Checking

The system SHALL query the confirmation status and spend status of UTXOs via mempool.space (primary) and blockstream.info (fallback). The result MUST include whether the UTXO is confirmed, its block height, whether it has been spent, and the spending transaction ID if applicable.

#### Scenario: Confirmed unspent UTXO

- **WHEN** a UTXO has been mined and not spent
- **THEN** the status SHALL report confirmed=true, spent=false, and include the block height

#### Scenario: Spent UTXO

- **WHEN** a UTXO has been spent
- **THEN** the status SHALL report spent=true and include the spending transaction ID

### Requirement: Fee Rate Estimation

The system SHALL estimate Bitcoin fee rates using mempool.space's recommended fees API, supporting low, medium, and high priority levels. When the API is unavailable, the system SHALL fall back to conservative defaults (low=5, medium=20, high=50 sat/vbyte).

#### Scenario: API available

- **WHEN** mempool.space fees API responds successfully
- **THEN** fee rates for low (economyFee), medium (halfHourFee), and high (fastestFee) SHALL be returned

#### Scenario: API unavailable

- **WHEN** the fees API request fails
- **THEN** fallback defaults SHALL be returned and a warning SHALL be logged

### Requirement: Client-Side Bitcoin Key Management

The system SHALL generate Bitcoin keypairs (secp256k1) client-side using `crypto.getRandomValues` and store them in `sessionStorage` for the duration of the browser session. Private keys MUST never be transmitted to the server. The system SHALL support storing keypairs for both owner and recipient roles, plus metadata (symmetricKeyK, nostrEventId, recipientAddress) needed for refresh operations.

#### Scenario: Generate and store keypair

- **WHEN** a keypair is generated for a secret and role
- **THEN** it SHALL be stored in sessionStorage keyed by `btc-keypair:{secretId}:{role}` in hex format

#### Scenario: Retrieve stored keypair

- **WHEN** a previously stored keypair is requested
- **THEN** the original privkey and pubkey SHALL be returned as Uint8Arrays

#### Scenario: Clear session data

- **WHEN** Bitcoin session data is cleared for a secret
- **THEN** both keypairs and metadata SHALL be removed from sessionStorage

### Requirement: UTXO Refresh (Check-In)

The system SHALL refresh a timelock UTXO by spending it via the owner (IF) branch and creating a new P2WSH output with a fresh CSV timelock. The witness for the owner-path spend MUST be [<owner_sig>, <TRUE (0x01)>, <witnessScript>]. The new UTXO amount SHALL be the previous amount minus the mining fee. The system SHALL estimate the number of remaining refreshes before the UTXO is depleted below the 10,000 satoshi minimum.

#### Scenario: Successful refresh

- **WHEN** the owner provides valid keys and the current UTXO details
- **THEN** a new transaction spending the old UTXO and creating a new timelock UTXO SHALL be returned

#### Scenario: UTXO depleted after fee

- **WHEN** the remaining amount after fee is below 10,000 satoshis
- **THEN** the system SHALL throw an error indicating insufficient funds for refresh

### Requirement: Server-Side Bitcoin UTXO Lifecycle

The system SHALL manage the full Bitcoin UTXO lifecycle through a service layer that coordinates transaction creation, broadcasting, database persistence, and status queries. Enabling Bitcoin on a secret SHALL verify ownership, check for existing active UTXOs, and store the UTXO record with status "pending". Refreshing SHALL atomically mark the old UTXO as "spent" and insert the new UTXO in a database transaction.

#### Scenario: Enable Bitcoin on a secret

- **WHEN** a user enables Bitcoin on their secret with valid funding
- **THEN** a timelock UTXO SHALL be created, broadcast, and stored in the database with status "pending"

#### Scenario: Duplicate enable rejected

- **WHEN** a user attempts to enable Bitcoin on a secret that already has a confirmed UTXO
- **THEN** the system SHALL throw an error

#### Scenario: Refresh rotates UTXO atomically

- **WHEN** a user refreshes (checks in) their Bitcoin UTXO
- **THEN** the old UTXO SHALL be marked "spent" and the new UTXO inserted with status "pending" in a single database transaction

#### Scenario: Query Bitcoin status

- **WHEN** a user queries the Bitcoin status of their secret
- **THEN** the system SHALL return the latest UTXO details, estimated days remaining, estimated refreshes remaining, and whether a pre-signed recipient transaction exists

### Requirement: Bitcoin UTXO Database Schema

The system SHALL persist Bitcoin UTXO records in a `bitcoin_utxos` PostgreSQL table with columns for secret association, transaction ID, output index, amount in satoshis, hex-encoded timelock script, hex-encoded owner and recipient pubkeys, TTL blocks, status (pending/confirmed/spent), pre-signed recipient transaction, and timestamps. The table MUST have indexes on secretId and status, and a unique constraint on (txId, outputIndex).

#### Scenario: Schema constraints enforced

- **WHEN** a UTXO record is inserted
- **THEN** the secretId foreign key, txId/outputIndex uniqueness, and status enum MUST be enforced by the database

### Requirement: UTXO Confirmation Cron Job

The system SHALL run a periodic cron job that queries pending Bitcoin UTXOs from the database and checks their confirmation status via blockchain APIs. Confirmed UTXOs SHALL be updated to "confirmed" status with a timestamp. The cron job MUST process at most 10 UTXOs per run to avoid API rate limiting, and MUST require cron authorization.

#### Scenario: Pending UTXO confirmed

- **WHEN** the cron job finds a pending UTXO whose transaction is confirmed on-chain
- **THEN** the UTXO status SHALL be updated to "confirmed" with the current timestamp

#### Scenario: No pending UTXOs

- **WHEN** the cron job runs and no pending UTXOs exist
- **THEN** it SHALL return successfully with processed=0

#### Scenario: API failure for individual UTXO

- **WHEN** the blockchain API check fails for one UTXO
- **THEN** the error SHALL be logged and the remaining UTXOs SHALL still be processed

### Requirement: Bitcoin Recovery UI

The system SHALL provide a client-side Bitcoin recovery step that allows recipients to paste a pre-signed transaction hex, parse it to extract the OP_RETURN payload (symmetric key K and Nostr event ID), fetch the corresponding gift-wrapped event from Nostr relays, and decrypt the share using K. All operations MUST execute entirely in the browser.

#### Scenario: Successful Bitcoin recovery

- **WHEN** a recipient pastes valid pre-signed transaction hex
- **THEN** the system SHALL extract K and the Nostr event ID, fetch the event from relays, decrypt the share, and display the result

#### Scenario: Event not found on relays

- **WHEN** the Nostr event referenced by the OP_RETURN cannot be found
- **THEN** the system SHALL display an error indicating the event was not found

