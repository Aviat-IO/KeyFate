# Nostr Integration Design Document

## Overview

This document outlines how KeyFate can integrate with the Nostr protocol to provide
**censorship-resistant secret disclosure** that doesn't depend on KeyFate's servers.

## Problem Statement

Users have a legitimate concern: "What if KeyFate goes out of business or becomes
unavailable?" Currently, if our servers are down during a disclosure event, the
recipient cannot receive the server-stored share.

Nostr solves this by providing:
1. **Decentralized delivery** - Messages can be delivered through any relay
2. **Censorship resistance** - No single point of failure
3. **Cryptographic privacy** - End-to-end encrypted messages
4. **Permanent availability** - Events persist across the relay network

## Relevant NIPs (Nostr Implementation Possibilities)

### Core NIPs Used

| NIP | Purpose | KeyFate Usage |
|-----|---------|---------------|
| NIP-01 | Basic protocol & event structure | Foundation for all events |
| NIP-44 | Versioned encryption | Encrypting share content |
| NIP-59 | Gift Wrap | Private delivery to recipients |
| NIP-17 | Private Direct Messages | Message delivery pattern |

### NIP-44: Versioned Encryption

NIP-44 is the modern encryption standard for Nostr (replacing deprecated NIP-04).

```typescript
// Derive conversation key between two parties
function getConversationKey(privateKeyA: Uint8Array, publicKeyB: string): Uint8Array {
  const sharedX = secp256k1_ecdh(privateKeyA, publicKeyB)
  return hkdf_extract(IKM=sharedX, salt='nip44-v2')
}

// Encrypt content
const encrypted = nip44.v2.encrypt(
  JSON.stringify(shareData),
  getConversationKey(senderPrivKey, recipientPubKey)
)
```

### NIP-59: Gift Wrap (Private Delivery)

Gift Wrap provides metadata privacy through a 3-layer structure:

```
┌─────────────────────────────────────────────┐
│ Gift Wrap (kind: 1059)                      │
│ - Random one-time pubkey                    │
│ - Recipient's pubkey in p-tag               │
│ - Randomized created_at (±2 days)           │
│ ┌─────────────────────────────────────────┐ │
│ │ Seal (kind: 13)                         │ │
│ │ - Sender's real pubkey (encrypted)      │ │
│ │ - Empty tags (no metadata leak)         │ │
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ Rumor (unsigned inner event)        │ │ │
│ │ │ - Actual content                    │ │ │
│ │ │ - Real created_at                   │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Architecture

### Components

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   KeyFate User   │     │  KeyFate Server  │     │  Nostr Network   │
│                  │     │                  │     │                  │
│  - Creates       │     │  - Stores 1      │     │  - Multiple      │
│    secret        │     │    share         │     │    relays        │
│  - Generates     │     │  - Monitors      │     │  - Redundant     │
│    Nostr keypair │     │    check-ins     │     │    storage       │
│  - Provides      │     │  - Publishes     │     │  - Global        │
│    recipient     │     │    gift-wrapped  │     │    availability  │
│    npub          │     │    events        │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Flow: Secret Creation with Nostr Backup

1. **User creates secret** (existing flow)
   - Secret split via Shamir's Secret Sharing
   - Shares distributed: user, recipient, KeyFate

2. **User enables Nostr disclosure** (new)
   - User provides recipient's Nostr public key (npub)
   - KeyFate generates a one-time disclosure keypair
   - Pre-encrypted gift wrap prepared for later broadcast

3. **Disclosure event triggers** (if user doesn't check in)
   - KeyFate broadcasts gift-wrapped share to Nostr relays
   - Recipient can receive from ANY relay
   - Works even if KeyFate servers go down after broadcast

### Event Structure

#### Share Disclosure Event (Inner Rumor)

```json
{
  "kind": 21059,
  "content": {
    "type": "keyfate_share_disclosure",
    "version": "1.0",
    "secret_id": "uuid",
    "share_index": 1,
    "share_data": "base64_encrypted_share",
    "threshold": 2,
    "total_shares": 3,
    "message": "Optional message from the secret creator",
    "instructions": "Combine with your share at keyfate.com/decrypt or use the offline tool"
  },
  "tags": [],
  "created_at": 1703021488
}
```

Note: We use a custom kind (21059) in the ephemeral range to avoid polluting
standard event kinds. The actual content is encrypted within the Gift Wrap.

#### Sealed Event (Kind 13)

```json
{
  "kind": 13,
  "pubkey": "<keyfate_disclosure_pubkey>",
  "content": "<nip44_encrypted_rumor>",
  "created_at": "<randomized_timestamp>",
  "tags": [],
  "sig": "<signature>"
}
```

#### Gift Wrapped Event (Kind 1059)

```json
{
  "kind": 1059,
  "pubkey": "<random_one_time_pubkey>",
  "content": "<nip44_encrypted_seal>",
  "created_at": "<randomized_timestamp>",
  "tags": [
    ["p", "<recipient_npub>"]
  ],
  "sig": "<signature>"
}
```

## Implementation Plan

### Phase 1: Recipient Nostr Key Storage

Add optional `nostr_pubkey` field to recipient model:

```typescript
interface Recipient {
  id: string
  email: string
  nostrPubkey?: string  // npub1... format
  // ... existing fields
}
```

### Phase 2: Pre-computed Gift Wraps

On secret creation (if Nostr enabled):
1. Generate ephemeral keypair for disclosure
2. Create and sign the inner rumor
3. Create and sign the seal
4. Store encrypted gift wrap (ready to broadcast)

```typescript
interface NostrDisclosure {
  secretId: string
  recipientNpub: string
  giftWrapEvent: string  // Ready-to-broadcast JSON
  ephemeralPubkey: string
  createdAt: Date
}
```

### Phase 3: Disclosure Broadcasting

When disclosure triggers:
1. Fetch pre-computed gift wrap
2. Broadcast to multiple relays simultaneously
3. Log broadcast status

```typescript
const DISCLOSURE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  // Add more for redundancy
]

async function broadcastDisclosure(giftWrap: string): Promise<BroadcastResult[]> {
  return Promise.allSettled(
    DISCLOSURE_RELAYS.map(relay => publishToRelay(relay, giftWrap))
  )
}
```

### Phase 4: Recipient Recovery UI

Add Nostr recovery option to `/decrypt` page:
1. User connects Nostr client or enters nsec
2. Query relays for gift-wrapped events tagged to their npub
3. Unwrap → Unseal → Decrypt → Combine shares

## Security Considerations

### Key Management

| Key Type | Storage | Purpose |
|----------|---------|---------|
| Recipient npub | Database (public) | Event routing |
| Ephemeral disclosure key | Encrypted at rest | Signing gift wraps |
| Random wrap keys | Generated per-use | Gift wrap privacy |

### Privacy Properties

- **Sender privacy**: Real sender hidden in sealed event
- **Recipient privacy**: Only recipient can decrypt
- **Timing privacy**: Randomized timestamps (±2 days)
- **Content privacy**: NIP-44 encryption throughout

### Relay Trust Model

- **No single relay required**: Broadcast to many, receive from any
- **Relays cannot read content**: All content encrypted
- **Relays cannot fake events**: Cryptographic signatures

## Database Schema Changes

```sql
-- Add Nostr support to recipients
ALTER TABLE recipients
ADD COLUMN nostr_pubkey VARCHAR(64);

-- New table for Nostr disclosures
CREATE TABLE nostr_disclosures (
  id UUID PRIMARY KEY,
  secret_id UUID REFERENCES secrets(id),
  recipient_id UUID REFERENCES recipients(id),
  gift_wrap_event TEXT NOT NULL,
  ephemeral_pubkey VARCHAR(64) NOT NULL,
  broadcast_status VARCHAR(20) DEFAULT 'pending',
  broadcast_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient lookup
CREATE INDEX idx_nostr_disclosures_secret_id ON nostr_disclosures(secret_id);
```

## API Changes

### New Endpoints

```typescript
// Enable Nostr disclosure for a recipient
POST /api/secrets/:secretId/recipients/:recipientId/nostr
{
  "nostrPubkey": "npub1..."
}

// Check Nostr disclosure status
GET /api/secrets/:secretId/nostr-status

// Query for received disclosures (client-side)
GET /api/nostr/received?npub=npub1...
```

## User Experience

### Secret Creation Flow

```
┌─────────────────────────────────────────┐
│ Add Recipient                           │
├─────────────────────────────────────────┤
│ Email: john@example.com                 │
│                                         │
│ ☑ Enable Nostr backup disclosure        │
│                                         │
│ Nostr Public Key (optional):            │
│ ┌─────────────────────────────────────┐ │
│ │ npub1abc123...                      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ℹ️ If enabled, your share will also be  │
│   broadcast to Nostr relays. This       │
│   ensures delivery even if KeyFate      │
│   is temporarily unavailable.           │
└─────────────────────────────────────────┘
```

### Recipient Recovery Flow

```
┌─────────────────────────────────────────┐
│ Recover Secret                          │
├─────────────────────────────────────────┤
│ How did you receive your share?         │
│                                         │
│ ○ I have an email with a recovery link  │
│ ○ I want to check Nostr for disclosures │
│                                         │
│ [Continue]                              │
└─────────────────────────────────────────┘
```

## Testing Strategy

1. **Unit tests**: Gift wrap creation, encryption/decryption
2. **Integration tests**: Full flow with test relays
3. **E2E tests**: Create secret → Miss check-in → Recover via Nostr

## Dependencies

```json
{
  "nostr-tools": "^2.x",
  "@noble/secp256k1": "^2.x",
  "@noble/hashes": "^1.x"
}
```

## Rollout Plan

1. **Alpha**: Pro users only, opt-in
2. **Beta**: All users, opt-in with clear messaging
3. **GA**: Default enabled for new secrets (with opt-out)

## Success Metrics

- Nostr adoption rate among Pro users
- Successful Nostr-based recoveries
- Relay broadcast success rate
- User satisfaction with backup option

## Future Enhancements

1. **Nostr-only secrets**: Users who only want Nostr disclosure (no email)
2. **Relay preferences**: Let users specify preferred relays
3. **NIP-65 integration**: Use recipient's declared inbox relays
4. **Multi-recipient Nostr**: Broadcast to multiple Nostr recipients

## References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [nostr-tools library](https://github.com/nbd-wtf/nostr-tools)
