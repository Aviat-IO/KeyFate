## Why

Email-based share delivery is centralized and can be intercepted, blocked, or surveilled. Nostr provides a decentralized, censorship-resistant transport for delivering encrypted Shamir shares to recipients. Using NIP-59 gift wrap encryption (rumor + seal + gift wrap), the system can publish shares to multiple relays without revealing the sender, recipient, or content to relay operators.

## What Changes

- Add Nostr relay pool management with configurable relay list and health checking
- Add NIP-44 v2 encryption/decryption wrapper (conversation key derivation, encrypt, decrypt)
- Add Nostr keypair generation with NIP-19 encoding/decoding (npub/nsec)
- Add NIP-59 Gift Wrap event construction (rumor kind 21059, seal kind 13, gift wrap kind 1059)
- Add double-encryption orchestrator (ChaCha20-Poly1305 + NIP-44 + optional passphrase + plaintext K)
- Add Nostr share publishing service with per-recipient gift wrapping
- Add `nostr_pubkey` column on recipients table
- Add Nostr recovery step in the client-side recovery UI (relay search, event unwrapping, K recovery)

## Impact

- Affected specs: none (new capability)
- Affected code:
  - `src/lib/nostr/` (5 modules: client, gift-wrap, keypair, encryption, relay-config)
  - `src/lib/services/nostr-publisher.ts`
  - `src/lib/crypto/double-encrypt.ts`
  - `src/lib/crypto/recovery.ts` (recoverKFromNostr)
  - `src/lib/db/schema.ts` (nostrPubkey on recipients)
  - `src/lib/components/recovery/NostrRecoveryStep.svelte`
  - `src/routes/recover/+page.svelte`
- Dependencies: `nostr-tools` (SimplePool, NIP-19, NIP-44, event signing)
- Cross-cutting: Shares encrypted via double-encryption are also recoverable through Bitcoin OP_RETURN and passphrase paths
