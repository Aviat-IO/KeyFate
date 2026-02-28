## Context

KeyFate must survive two threat scenarios: (1) server seizure/takedown and (2)
operator disappearance. The current architecture relies entirely on centralized
infrastructure. The Nostr + Bitcoin hybrid design provides a trustless fallback
where Bitcoin enforces timing (via CSV timelocks) and Nostr relays persist
encrypted shares.

## Goals / Non-Goals

- Goals:
  - Trustless secret disclosure that works without KeyFate infrastructure
  - Quantum-resistant encryption for pre-published shares
  - Progressive UX: web-first for happy path, Bitcoin+Nostr for fallback
  - Recipients can recover shares using only a Bitcoin transaction and a Nostr
    client

- Non-Goals:
  - Replacing KeyFate's primary web-based workflow
  - Requiring all users to have Bitcoin wallets (opt-in Pro feature)
  - Building custom blockchain infrastructure
  - Supporting Ethereum/smart contracts (deferred)
  - IPFS/Arweave integration (deferred, Nostr relays sufficient for now)

## Decisions

### Bitcoin CSV Timelocks (not CLTV)

CSV (OP_CHECKSEQUENCEVERIFY) is used instead of CLTV because:

- CSV is relative to UTXO creation time, which maps naturally to "time since
  last check-in"
- Refreshing (check-in) simply spends the UTXO and recreates it, resetting the
  clock
- Max duration ~388 days, sufficient for check-in intervals up to 12 months

Script structure:

```
OP_IF
    <owner_pubkey> OP_CHECKSIG
OP_ELSE
    <ttl_blocks> OP_CHECKSEQUENCEVERIFY OP_DROP
    <recipient_pubkey> OP_CHECKSIG
OP_ENDIF
```

### Double Encryption (Quantum Resistance)

The user raised a valid concern about NIP-44's secp256k1 ECDH being vulnerable
to quantum attacks (Shor's algorithm). The mitigation:

1. Generate random symmetric key `K` (256-bit)
2. Encrypt share with `K` using ChaCha20-Poly1305 (quantum-safe)
3. Encrypt `K` with recipient's Nostr pubkey via NIP-44 (convenient, NOT
   quantum-safe)
4. Store `K` in Bitcoin OP_RETURN (revealed only on trigger, quantum-safe since
   symmetric)
5. Optional: encrypt `K` with pre-shared passphrase via PBKDF2 -> AES-256-GCM
   (quantum-safe)

Recipient has three paths to get `K`:

- Bitcoin OP_RETURN (trustless, quantum-safe, requires timeout)
- NIP-44 decryption (convenient, NOT quantum-safe long-term)
- Passphrase (quantum-safe, requires out-of-band sharing)

### Nostr Event Structure

Gift Wrap (NIP-59) with inner event containing the encrypted share:

```
Outer (Gift Wrap): kind 1059, random pubkey, sealed content
  Inner (Seal): kind 13, sender pubkey, NIP-44 encrypted
    Content: JSON {
      share: <ChaCha20 encrypted with K>,
      pointer: <Nostr event ID for relay retrieval>,
      threshold: 2,
      total_shares: 3,
      version: 1
    }
```

### OP_RETURN Contents

32 bytes encrypted `K` + 32 bytes Nostr event ID = 64 bytes total. Fits within
all node implementations' OP_RETURN limits.

### Cost Model

- Bitcoin tx fees: ~$10-50/year per secret (depending on check-in frequency and
  fee environment)
- This is a Pro-tier feature; free-tier users use the web-only workflow
- Users must lock a small amount of BTC in the UTXO (minimum ~10,000 sats for
  economic spendability)

## Risks / Trade-offs

- Risk: Bitcoin tx fees spike during check-in -> Mitigation: batch refreshes,
  use Taproot for lower fees, allow users to set fee priority
- Risk: Recipient doesn't know how to broadcast a Bitcoin tx -> Mitigation:
  build guided recovery UI with clear instructions
- Risk: Nostr relays purge old events -> Mitigation: publish to 5+ relays,
  periodic re-publishing
- Risk: CSV max ~388 days is insufficient -> Mitigation: switch to CLTV for
  intervals > 12 months (requires script change on each refresh)
- Risk: `bitcoinjs-lib` compatibility with Bun -> Mitigation: test early; fall
  back to `@noble/secp256k1` + manual script construction if needed

## Migration Plan

This builds on top of `add-service-continuity` tasks 2.x (Nostr integration):

1. Implement Nostr keypair generation and share publishing (from existing tasks)
2. Add double encryption layer (new)
3. Implement Bitcoin CSV timelock creation (new)
4. Implement check-in refresh via UTXO spend+recreate (new)
5. Build pre-signed transaction with OP_RETURN (new)
6. Build recipient recovery UI (new)
7. Schema changes: `nostr_pubkey` on recipients, `bitcoin_utxo` tracking table
   (new)

## Open Questions

1. Should the Bitcoin wallet be managed by KeyFate (custodial, simpler UX) or by
   the user (non-custodial, more complex)?
2. How do we handle the pre-signed transaction delivery to recipients? (Email?
   Nostr DM? Recovery kit download?)
3. Should we support Lightning Network for fee payments, even though LN can't do
   timelocks?
