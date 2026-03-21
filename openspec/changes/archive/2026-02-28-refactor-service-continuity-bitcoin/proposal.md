## Why

The existing `add-service-continuity` change proposal covers Nostr integration,
decentralized storage (IPFS/Arweave), and Bitcoin timelocks as separate future
items. After architectural review, the optimal design is a **Nostr + Bitcoin
hybrid** where Bitcoin CSV timelocks provide trustless trigger enforcement and
Nostr relays provide censorship-resistant encrypted share delivery. This change
refines and replaces the Bitcoin/trigger portions of the existing proposal with
a concrete, implementable design that addresses quantum resistance concerns.

## What Changes

- Add Bitcoin CSV timelock integration for trustless dead man's switch trigger
- Add double encryption scheme: symmetric key `K` (ChaCha20, quantum-safe) +
  NIP-44 (convenient) + optional passphrase (quantum-safe backup)
- Refine Nostr share publishing to use Gift Wrap (NIP-59) with double encryption
- Add pre-signed Bitcoin transaction generation with OP_RETURN containing Nostr
  event pointer + encrypted `K`
- Add check-in refresh mechanism (spend + recreate UTXO to reset CSV clock)
- Add recipient recovery UI for Bitcoin + Nostr fallback path
- Add `nostr-tools`, `bitcoinjs-lib`, `@noble/secp256k1`, `@noble/hashes`
  dependencies

**Note**: This builds on top of the Nostr integration from
`add-service-continuity` (tasks 2.x). The export system (tasks 1.x) is already
implemented. This change adds the Bitcoin layer and refines the Nostr encryption
approach.

## Impact

- Affected specs: `data-protection` (new decentralized disclosure requirements)
- Affected code:
  - `src/lib/nostr/` (new - Nostr client, encryption, relay management)
  - `src/lib/bitcoin/` (new - CSV timelock, UTXO management, transaction
    signing)
  - `src/lib/crypto/` (new - double encryption, key management)
  - `src/routes/(authenticated)/secrets/[id]/bitcoin/` (new - Bitcoin setup UI)
  - `src/routes/recover/` (new - recipient recovery page for Bitcoin + Nostr
    fallback)
  - `src/lib/db/schema.ts` (modified - add `nostr_pubkey` to recipients, add
    `bitcoin_utxo` table)
