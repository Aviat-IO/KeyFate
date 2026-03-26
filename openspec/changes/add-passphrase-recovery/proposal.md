## Why

The NIP-44 Nostr recovery path depends on secp256k1 ECDH, which is vulnerable to quantum computing attacks (Shor's algorithm). A passphrase-based recovery path using PBKDF2-SHA256 and AES-256-GCM provides a quantum-safe alternative that relies only on symmetric cryptographic primitives. This gives recipients a third independent method to recover the symmetric key K without requiring Bitcoin or Nostr infrastructure.

## What Changes

- Add PBKDF2-SHA256 key derivation (600,000 iterations per OWASP 2023) with AES-256-GCM encryption via Web Crypto API
- Add three-path K recovery module with functions for Nostr, passphrase, and Bitcoin OP_RETURN recovery
- Add share decryption using recovered K (ChaCha20-Poly1305)
- Add passphrase recovery step UI component
- Add recovery result display with Shamir secret reconstruction
- Add recovery method selector and guide components
- Integrate passphrase recovery into the `/recover` page alongside Nostr and Bitcoin methods

## Impact

- Affected specs: none (new capability)
- Affected code:
  - `src/lib/crypto/passphrase.ts`
  - `src/lib/crypto/recovery.ts`
  - `src/lib/crypto/double-encrypt.ts` (passphrase integration)
  - `src/lib/components/recovery/PassphraseRecoveryStep.svelte`
  - `src/lib/components/recovery/RecoveryResultStep.svelte`
  - `src/routes/recover/+page.svelte`
  - `src/routes/recover/+page.ts`
- Dependencies: Web Crypto API (built-in, no external dependencies)
- Cross-cutting: K encrypted with passphrase during double-encryption; recovered via passphrase in recovery flow
