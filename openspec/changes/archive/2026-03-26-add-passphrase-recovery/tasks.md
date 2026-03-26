## 1. Passphrase Key Derivation

- [x] 1.1 Implement PBKDF2-SHA256 key derivation (600K iterations) via Web Crypto API in `src/lib/crypto/passphrase.ts`
- [x] 1.2 Implement AES-256-GCM encryption with derived key
- [x] 1.3 Implement AES-256-GCM decryption with derived key
- [x] 1.4 Support optional existing salt for decryption (generate new for encryption)

## 2. Three-Path K Recovery

- [x] 2.1 Implement `recoverKFromNostr` (NIP-44 decrypt K) in `src/lib/crypto/recovery.ts`
- [x] 2.2 Implement `recoverKFromPassphrase` (PBKDF2 derive key, AES-GCM decrypt K)
- [x] 2.3 Implement `recoverKFromOpReturn` (extract raw 32-byte K from OP_RETURN)
- [x] 2.4 Implement `decryptShare` (ChaCha20-Poly1305 decrypt share with K)

## 3. Double Encryption Integration

- [x] 3.1 Integrate passphrase encryption into `doubleEncryptShare` in `src/lib/crypto/double-encrypt.ts`
- [x] 3.2 When passphrase provided: derive key, encrypt K, return EncryptedKPassphrase bundle (ciphertext, nonce, salt)

## 4. Recovery UI Components

- [x] 4.1 Implement PassphraseRecoveryStep component (passphrase input, bundle JSON input, encrypted share/nonce inputs)
- [x] 4.2 Implement RecoveryResultStep component (display decrypted shares, copy-to-clipboard, reconstruct secret)
- [x] 4.3 Implement recovery method selector (nostr/bitcoin/passphrase chooser)
- [x] 4.4 Implement recovery guide component

## 5. Recovery Page

- [x] 5.1 Implement `/recover` page with step-based flow (choose method -> recover -> result)
- [x] 5.2 Support accumulating shares across multiple recovery attempts
- [x] 5.3 Integrate SSSDecryptor component for Shamir reconstruction when 2+ shares recovered

## 6. Testing

- [x] 6.1 Unit tests for PBKDF2 key derivation
- [x] 6.2 Unit tests for AES-256-GCM encrypt/decrypt round-trip
- [x] 6.3 Unit tests for recoverKFromPassphrase
- [x] 6.4 Unit tests for recoverKFromOpReturn
- [x] 6.5 Unit tests for decryptShare with recovered K
- [x] 6.6 Unit tests for double-encrypt with passphrase integration
