## Context

The double-encryption scheme produces a symmetric key K that encrypts Shamir shares via ChaCha20-Poly1305. K must be recoverable through multiple independent paths. While Nostr (NIP-44) and Bitcoin (OP_RETURN) provide two paths, both require infrastructure access. A passphrase-based path provides a standalone, offline-capable recovery method that is also quantum-safe.

The passphrase recovery system is part of the broader three-path K recovery architecture alongside Nostr and Bitcoin recovery.

## Goals / Non-Goals

- Goals:
  - PBKDF2-SHA256 key derivation with 600,000 iterations (OWASP 2023 recommendation)
  - AES-256-GCM authenticated encryption for K
  - Web Crypto API only (works in both Bun server-side and browser client-side)
  - Client-side recovery UI that works entirely offline after page load
  - Recovery kit format: JSON bundle with hex-encoded ciphertext, nonce, and salt
  - Integration with Shamir secret reconstruction after share decryption

- Non-Goals:
  - Passphrase strength enforcement or validation (user responsibility)
  - Passphrase storage or transmission (strictly out-of-band sharing)
  - Key stretching algorithm alternatives (Argon2, scrypt)
  - Hardware security module integration

## Decisions

- **PBKDF2-SHA256 over Argon2/scrypt**: Web Crypto API natively supports PBKDF2 but not Argon2 or scrypt. Avoids external WASM dependencies. 600K iterations provides adequate security per OWASP 2023.
- **AES-256-GCM over ChaCha20**: Web Crypto API provides native AES-GCM support. ChaCha20 would require importing `@noble/ciphers` for passphrase encryption (it is already used for share encryption, but keeping passphrase encryption in Web Crypto keeps the paths independent).
- **Non-extractable CryptoKey**: The derived key is marked `extractable: false` to prevent accidental exposure via the Web Crypto API.
- **128-bit salt, 96-bit nonce**: Standard sizes for PBKDF2 salt and AES-GCM IV respectively. Salt is per-encryption to ensure unique key derivation even with the same passphrase.
- **JSON bundle format**: The encrypted K bundle is a JSON object with hex-encoded fields, making it easy to embed in recovery kits and paste into the recovery UI.

## Risks / Trade-offs

- **Passphrase quality**: Security depends entirely on passphrase entropy. A weak passphrase renders this path insecure. Mitigation: documentation recommends strong passphrases; this is one of three paths.
- **Out-of-band sharing requirement**: The passphrase and encrypted K bundle must be shared with the recipient through a separate channel. Mitigation: recovery kit includes the bundle; passphrase is communicated separately.
- **PBKDF2 performance**: 600K iterations takes ~200-500ms on modern hardware. Acceptable for a recovery operation but noticeable. Mitigation: UI shows loading indicator during derivation.
- **No key stretching upgrade path**: If PBKDF2 becomes insufficient, existing encrypted bundles cannot be re-derived with a stronger algorithm without the original passphrase. Mitigation: version field in bundle format allows future algorithm changes.

## Migration Plan

1. No schema changes required (passphrase data stored in recovery kit, not database)
2. Feature is opt-in: passphrase only used when provided during secret creation
3. Recovery page is public and works for any encrypted bundle
4. Rollback: remove passphrase UI components; existing bundles remain valid

## Open Questions

- Should the system enforce minimum passphrase length or complexity?
- Should the recovery kit format include a version number for algorithm upgrades?
- Should there be a "test passphrase" feature that verifies the passphrase can decrypt K before the user needs it for real recovery?
