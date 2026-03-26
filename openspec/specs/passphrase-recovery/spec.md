# passphrase-recovery Specification

## Purpose
TBD - created by archiving change add-passphrase-recovery. Update Purpose after archive.
## Requirements
### Requirement: PBKDF2-SHA256 Key Derivation from Passphrase

The system SHALL derive a 256-bit AES key from a user-provided passphrase using PBKDF2-SHA256 with 600,000 iterations (per OWASP 2023 guidelines) via the Web Crypto API. A 128-bit (16-byte) random salt MUST be generated for each encryption operation. The derived CryptoKey MUST be non-extractable and usable only for AES-GCM encrypt/decrypt operations. The passphrase MUST NOT be empty.

#### Scenario: Derive key with new salt

- **WHEN** a passphrase is provided without an existing salt
- **THEN** a new random 16-byte salt SHALL be generated, and a non-extractable AES-256-GCM CryptoKey SHALL be returned along with the salt

#### Scenario: Derive key with existing salt

- **WHEN** a passphrase and an existing salt are provided
- **THEN** the same derived key SHALL be produced, enabling decryption of data encrypted with that salt

#### Scenario: Empty passphrase rejected

- **WHEN** an empty string is provided as the passphrase
- **THEN** the system SHALL throw an error

### Requirement: AES-256-GCM Authenticated Encryption

The system SHALL encrypt and decrypt data using AES-256-GCM with a 96-bit (12-byte) random nonce via the Web Crypto API. The ciphertext MUST include the GCM authentication tag. Decryption MUST fail with an error if the authentication tag does not match (wrong key or tampered ciphertext).

#### Scenario: Encrypt and decrypt round-trip

- **WHEN** data is encrypted with a derived key and then decrypted with the same key and nonce
- **THEN** the original plaintext SHALL be returned

#### Scenario: Wrong key fails decryption

- **WHEN** ciphertext is decrypted with a different key than was used for encryption
- **THEN** the system SHALL throw an error (authentication failure)

#### Scenario: Tampered ciphertext fails decryption

- **WHEN** the ciphertext is modified after encryption
- **THEN** decryption SHALL fail with an authentication error

### Requirement: Three-Path Symmetric Key Recovery

The system SHALL support three independent paths for recovering the 32-byte symmetric key K that encrypts Shamir shares:
1. **Nostr (NIP-44)**: Decrypt K from a NIP-44 payload using the recipient's Nostr private key and the sender's public key
2. **Passphrase**: Derive an AES key from a passphrase and salt, then decrypt K from an AES-256-GCM ciphertext
3. **Bitcoin OP_RETURN**: Extract the raw 32-byte K directly from a Bitcoin OP_RETURN payload

Each path MUST validate that the recovered K is exactly 32 bytes.

#### Scenario: Recover K via Nostr

- **WHEN** a valid NIP-44 encrypted K, recipient private key, and sender public key are provided
- **THEN** a 32-byte symmetric key K SHALL be returned

#### Scenario: Recover K via passphrase

- **WHEN** a valid passphrase and encrypted K bundle (ciphertext, nonce, salt) are provided
- **THEN** a 32-byte symmetric key K SHALL be returned

#### Scenario: Recover K via Bitcoin OP_RETURN

- **WHEN** a 32-byte OP_RETURN payload is provided
- **THEN** a copy of the 32-byte symmetric key K SHALL be returned

#### Scenario: Invalid K length from any path

- **WHEN** the recovered K is not exactly 32 bytes
- **THEN** the system SHALL throw an error indicating the expected length

### Requirement: Share Decryption with Recovered K

The system SHALL decrypt ChaCha20-Poly1305 encrypted Shamir shares using the recovered 32-byte symmetric key K and the 12-byte nonce used during encryption. The decrypted bytes SHALL be decoded as a UTF-8 string to produce the original share.

#### Scenario: Successful share decryption

- **WHEN** a valid encrypted share, nonce, and correct K are provided
- **THEN** the original Shamir share string SHALL be returned

#### Scenario: Wrong K fails decryption

- **WHEN** an incorrect K is used for decryption
- **THEN** the system SHALL throw an error (authentication failure)

### Requirement: Passphrase Recovery UI

The system SHALL provide a client-side passphrase recovery component that accepts: (1) a recovery passphrase, (2) an encrypted K bundle in JSON format (containing hex-encoded ciphertext, nonce, and salt), (3) hex-encoded encrypted share data, and (4) a hex-encoded share nonce. The component MUST derive the key from the passphrase, decrypt K from the bundle, and decrypt the share with K. All operations MUST execute entirely in the browser.

#### Scenario: Successful passphrase recovery

- **WHEN** a correct passphrase, valid encrypted K bundle, and encrypted share data are provided
- **THEN** the decrypted share SHALL be displayed and passed to the completion handler

#### Scenario: Wrong passphrase

- **WHEN** an incorrect passphrase is provided
- **THEN** the system SHALL display an error indicating the recovery failed

#### Scenario: Missing required fields

- **WHEN** any required field (passphrase, bundle, share data, nonce) is empty
- **THEN** the decrypt button SHALL be disabled

### Requirement: Recovery Result Display

The system SHALL display decrypted share results showing the share index, threshold, total shares, and secret ID when available. The system MUST support copying individual shares to the clipboard. The system SHALL accumulate recovered shares across multiple recovery attempts within a session and enable Shamir secret reconstruction when 2 or more shares are available.

#### Scenario: Display single decrypted share

- **WHEN** one share is successfully decrypted
- **THEN** the share text, metadata, and copy button SHALL be displayed

#### Scenario: Accumulate shares for reconstruction

- **WHEN** multiple shares are recovered across different recovery attempts
- **THEN** the total recovered share count SHALL be displayed and the "Reconstruct Secret" button SHALL be enabled when count >= 2

#### Scenario: Insufficient shares for reconstruction

- **WHEN** fewer than 2 shares have been recovered
- **THEN** the "Reconstruct Secret" button SHALL be disabled with a message indicating more shares are needed

### Requirement: Recovery Page Flow

The system SHALL provide a `/recover` page with a three-step flow: (1) choose recovery method (nostr, bitcoin, or passphrase), (2) perform recovery using the selected method, (3) display results and offer reconstruction. The page MUST work entirely client-side with no server communication. Navigation between steps MUST be supported via back buttons.

#### Scenario: Select and use recovery method

- **WHEN** a user selects a recovery method and completes the recovery step
- **THEN** the decrypted shares SHALL be displayed in the result step

#### Scenario: Navigate back

- **WHEN** a user clicks the back button from the result step
- **THEN** the system SHALL return to the recovery step preserving previously recovered shares

#### Scenario: Recover another share

- **WHEN** a user clicks "Recover Another Share" from the result step
- **THEN** the system SHALL return to the method selection step while preserving accumulated shares

#### Scenario: Security notice

- **WHEN** the recovery page is displayed
- **THEN** a security notice SHALL inform the user that all decryption happens locally and keys are never transmitted

