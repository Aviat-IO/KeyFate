## Context

KeyFate needs a decentralized transport for delivering encrypted Shamir shares that does not depend on email infrastructure. Nostr is a decentralized protocol with established NIPs for encrypted messaging. NIP-59 (Gift Wrap) provides sender anonymity through ephemeral keys, while NIP-44 provides modern authenticated encryption between keypairs.

The Nostr layer serves as both a delivery transport (gift-wrapped events published to relays) and one of three independent K-recovery paths (NIP-44 decryption of the symmetric key K).

## Goals / Non-Goals

- Goals:
  - Publish double-encrypted shares as NIP-59 gift-wrapped events to multiple relays
  - Use custom kind 21059 for KeyFate share rumor events
  - Sender anonymity via ephemeral keys on the gift wrap layer
  - Timestamp randomization (within 2-day window) to prevent timing analysis
  - Relay health checking and minimum publish threshold (3 relays)
  - Client-side recovery: search relays by nsec, unwrap events, recover K
  - Support both npub and hex pubkey formats for recipients

- Non-Goals:
  - Real-time relay subscriptions or push notifications
  - Relay authentication (NIP-42)
  - Relay-specific event deletion or expiration
  - Custom relay hosting
  - NIP-17 direct messages (uses NIP-59 gift wrap instead)

## Decisions

- **NIP-59 Gift Wrap over NIP-17 DM**: Gift wraps provide stronger sender anonymity via ephemeral keys. The outer event reveals only the recipient's pubkey, not the sender's identity.
- **Custom kind 21059**: A custom rumor kind avoids collision with standard Nostr event kinds and allows KeyFate-specific filtering. The kind number is in the ephemeral range.
- **10 default relays**: A curated list of reliable, well-known relays ordered by reliability. Users cannot configure custom relays in the current implementation.
- **SimplePool from nostr-tools**: Established, maintained library with built-in connection management. Avoids reimplementing the Nostr protocol.
- **NIP-44 v2 for inner encryption**: Current standard for Nostr payload encryption. Uses HKDF + ChaCha20 + HMAC. Note: relies on secp256k1 ECDH which is NOT quantum-safe.
- **Double encryption for quantum resistance**: The inner ChaCha20-Poly1305 layer with random key K is quantum-safe. NIP-44 encrypts K for convenience, but K is also available via passphrase (quantum-safe) and Bitcoin OP_RETURN (quantum-safe).

## Risks / Trade-offs

- **NIP-44 is NOT quantum-safe**: Relies on secp256k1 ECDH key agreement. This is mitigated by the three-path K recovery design where two paths (passphrase, Bitcoin) are quantum-safe.
- **Relay availability**: Relays can go offline, lose data, or refuse connections. Mitigated by publishing to 10 relays and requiring at least 3 to accept.
- **Relay data retention**: No guarantee relays store events permanently. Gift-wrapped events may be pruned. Mitigated by publishing to many relays; the Bitcoin OP_RETURN path serves as a permanent fallback.
- **nostr-tools dependency size**: Adds to bundle size. Mitigated by tree-shaking unused modules.
- **Gift wrap timestamp randomization**: 2-day window provides some timing privacy but may not be sufficient against well-resourced adversaries who monitor relay submissions in real-time.

## Migration Plan

1. Add `nostr_pubkey` column to recipients table (nullable text)
2. Feature is opt-in: only recipients with a nostrPubkey get Nostr delivery
3. No changes to existing email delivery flow
4. Rollback: remove nostrPubkey column; Nostr events remain on relays but become inert

## Open Questions

- Should the system verify recipient Nostr pubkeys are reachable on relays before publishing?
- Should there be a mechanism to re-publish events to additional relays if the initial publish reaches fewer than the minimum?
- Should the relay list be user-configurable per secret or globally?
