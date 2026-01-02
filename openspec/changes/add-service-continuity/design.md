# Service Continuity Design Document

## Context

KeyFate is a dead man's switch platform using Shamir's Secret Sharing. Users create secrets that are disclosed to recipients if they fail to check in. Currently, the system has critical single points of failure:

| Component | Dependency | Impact if Lost |
|-----------|------------|----------------|
| Server share | PostgreSQL on Cloud SQL | Cannot reconstruct secrets |
| Check-in system | Cloud Run + cron jobs | No deadline tracking |
| Disclosure trigger | `/api/cron/process-reminders` | Secrets never disclosed |
| User-managed shares | localStorage (2h expiry!) | Users lose shares quickly |

**Core Problem**: If KeyFate shuts down, users' secrets become orphaned with no path to recovery or disclosure.

## Goals / Non-Goals

### Goals

- Enable secret recovery without KeyFate infrastructure
- Support automatic disclosure when KeyFate is unavailable
- Provide multiple redundant storage mechanisms
- Maintain zero-knowledge security model
- Keep complexity manageable for non-technical users

### Non-Goals

- Replace KeyFate's primary infrastructure
- Require cryptocurrency knowledge for basic features
- Guarantee 100% availability (defense in depth instead)
- Build custom blockchain infrastructure

---

## Solution 1: Export/Backup System

**Priority: Implement First**

### Concept

Users download a complete "recovery kit" containing everything needed to recover secrets without KeyFate.

### Recovery Kit Contents

```
keyfate-recovery-kit-{secretId}.zip
├── recovery.html          # Standalone recovery tool (works offline)
├── shares/
│   ├── server-share.txt   # Decrypted server share
│   └── user-shares.txt    # All user-managed shares
├── metadata.json          # Secret config, recipients, threshold
├── instructions.pdf       # Human-readable recovery guide
└── README.md              # Technical documentation
```

### Standalone Recovery Tool

`recovery.html` is a single-file JavaScript application that:
- Works completely offline (no server calls)
- Implements Shamir's Secret Sharing reconstruction
- Provides step-by-step guidance
- Can be shared with recipients

### Implementation Details

**Files to create:**
- `frontend/src/app/(authenticated)/secrets/[id]/export/page.tsx`
- `frontend/src/lib/export-recovery-kit.ts`
- `frontend/src/components/ExportButton.tsx`
- `frontend/public/recovery-template.html`

**Flow:**
1. User clicks "Export Recovery Kit" in secret details
2. System retrieves decrypted server share (via existing reveal endpoint)
3. System retrieves user-managed shares from localStorage
4. System bundles all components into downloadable ZIP
5. User stores ZIP securely (cloud drive, USB, etc.)

### Standalone Recovery HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>KeyFate Recovery Tool</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body>
  <h1>KeyFate Secret Recovery</h1>
  <div id="recovery-form">
    <h2>Enter Your Shares</h2>
    <p>You need at least <span id="threshold">2</span> shares to recover your secret.</p>
    <div id="share-inputs"></div>
    <button onclick="recoverSecret()">Recover Secret</button>
  </div>
  <div id="result" style="display:none">
    <h2>Recovered Secret</h2>
    <pre id="secret-content"></pre>
  </div>
  <script>
    // Embedded shamirs-secret-sharing implementation
    // Self-contained, no external dependencies required
  </script>
</body>
</html>
```

### Limitations

- Requires user action (not automatic)
- User must securely store the kit
- No automatic disclosure trigger

---

## Solution 2: Nostr Integration

**Strategic alignment with existing roadmap**

### Concept

Publish encrypted shares to multiple Nostr relays. Relays persist data indefinitely, providing censorship-resistant storage.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   KeyFate App   │────▶│  Nostr Relays   │
│                 │     │  (Multiple)     │
└─────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌─────────────────┐
         │              │ Encrypted Share │
         │              │ (NIP-17 format) │
         │              └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│   Recipients    │────▶│ Recovery Tool   │
│                 │     │ (Standalone)    │
└─────────────────┘     └─────────────────┘
```

### Relevant NIPs (Nostr Improvement Proposals)

- **NIP-01**: Basic protocol (events, relays)
- **NIP-04/NIP-44**: Encrypted direct messages
- **NIP-17**: Private encrypted messages (no metadata leak)
- **NIP-96**: File storage on servers

### Data Structure

```typescript
interface NostrShareEvent {
  kind: 30078; // Parameterized replaceable event
  pubkey: string; // User's Nostr pubkey
  content: encryptedShare; // NIP-44 encrypted
  tags: [
    ["d", secretId], // Identifier
    ["e", disclosureDeadline], // Unix timestamp
    ["p", recipientPubkey], // Recipient's Nostr pubkey
    ["threshold", "2"], // SSS threshold required
    ["shares_total", "3"], // Total shares created
  ];
}
```

### Automatic Disclosure via Nostr

**Option A: Time-Delayed Events**
- Publish events with future timestamps
- Relays hold until timestamp reached
- Recipients poll relays for disclosed shares

**Option B: Nostr Bots (Oracles)**
- Deploy bot that monitors check-in status
- Bot publishes disclosure event when deadline passes
- Multiple redundant bots for reliability

**Option C: Decentralized Triggers (NIP-90)**
- Use NIP-90 (Data Vending Machines) for computation
- External services monitor deadlines and trigger disclosure
- Requires payment in sats but fully decentralized

### Implementation

```typescript
// frontend/src/lib/nostr/publish-share.ts
import { getPublicKey, nip44, finalizeEvent } from 'nostr-tools';

export async function publishShareToNostr(
  secretId: string,
  encryptedShare: string,
  recipientPubkey: string,
  deadline: Date,
  relays: string[]
) {
  const event = {
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', secretId],
      ['e', Math.floor(deadline.getTime() / 1000).toString()],
      ['p', recipientPubkey],
    ],
    content: await nip44.encrypt(encryptedShare, recipientPubkey),
  };

  const signedEvent = finalizeEvent(event, userPrivateKey);

  for (const relay of relays) {
    await publishToRelay(relay, signedEvent);
  }
}
```

### Recommended Relays

```typescript
const RECOMMENDED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
];
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Censorship-resistant | Relay reliability varies |
| No single point of failure | Nostr ecosystem still maturing |
| Aligns with roadmap | Requires users to have Nostr identity |
| Growing ecosystem ($10M Jack Dorsey donation 2025) | No guaranteed persistence |
| Free to use | Need multiple relays for redundancy |

### Sources
- [Nostr Protocol](https://nostr.how/en/the-protocol)
- [NIPs Repository](https://github.com/nostr-protocol/nips)
- [NIP-17 Encrypted Messages](https://www.e2encrypted.com/nostr/nips/17/)

---

## Solution 3: Decentralized Storage

### Option 3A: IPFS + Filecoin

**Concept**: Store encrypted shares on IPFS with Filecoin for persistence guarantees.

```
┌─────────────────┐     ┌─────────────────┐
│   KeyFate App   │────▶│   IPFS Network  │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│  CID (Content   │     │ Filecoin Miners │
│  Identifier)    │     │ (Persistence)   │
└─────────────────┘     └─────────────────┘
```

**Implementation:**
1. Encrypt server share with recipient's public key
2. Upload to IPFS, get CID (content hash)
3. Pin to Filecoin for long-term storage
4. Store CID in recovery kit / send to recipient
5. Recipient retrieves via any IPFS gateway

**Code Example:**
```typescript
// frontend/src/lib/decentralized-storage/ipfs.ts
import { create } from 'ipfs-http-client';

export async function uploadToIPFS(
  encryptedShare: string,
  metadata: SecretMetadata
): Promise<string> {
  const ipfs = create({ url: 'https://ipfs.infura.io:5001' });

  const data = JSON.stringify({
    share: encryptedShare,
    threshold: metadata.threshold,
    totalShares: metadata.totalShares,
    version: 1,
  });

  const result = await ipfs.add(data);
  return result.cid.toString(); // e.g., "QmXyz..."
}
```

**Costs:**
- IPFS pinning: ~$0.01-0.10/GB/month (Pinata, Web3.Storage)
- Filecoin: ~$0.0001/GB/month for storage deals

### Option 3B: Arweave (Permanent Storage)

**Concept**: Pay once, store forever on Arweave.

```
┌─────────────────┐     ┌─────────────────┐
│   KeyFate App   │────▶│    Arweave      │
│                 │     │ (Permaweb)      │
└─────────────────┘     └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│ Transaction ID  │     │  200+ Years     │
│                 │     │  Persistence    │
└─────────────────┘     └─────────────────┘
```

**Implementation:**
```typescript
// frontend/src/lib/decentralized-storage/arweave.ts
import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

export async function uploadToArweave(
  encryptedShare: string,
  wallet: JWKInterface
): Promise<string> {
  const data = JSON.stringify({ share: encryptedShare });

  const transaction = await arweave.createTransaction({ data }, wallet);
  transaction.addTag('Content-Type', 'application/json');
  transaction.addTag('App-Name', 'KeyFate');
  transaction.addTag('Version', '1');

  await arweave.transactions.sign(transaction, wallet);
  await arweave.transactions.post(transaction);

  return transaction.id; // Permanent URL: arweave.net/{id}
}
```

**Costs:**
- One-time: ~$0.005/KB (current AR price)
- For 1KB share: approximately $0.005

### Existing Project: Sarcophagus

[Sarcophagus](https://sarcophagus.io) is a decentralized dead man's switch built on Ethereum + Arweave:
- Double-encrypted data stored by multiple nodes
- Archaeologists (node operators) resurrect data when triggered
- Already production-tested
- Could integrate rather than building from scratch

**Integration Option:**
```typescript
// Use Sarcophagus SDK instead of building from scratch
import { SarcophagusClient } from '@sarcophagus-org/sdk';

const client = new SarcophagusClient();
await client.createSarcophagus({
  payload: encryptedShare,
  recipientPublicKey: recipientKey,
  resurrectionTime: deadline,
  archaeologists: 3, // Redundancy
});
```

### Option 3C: Hybrid Storage

Store on multiple networks for maximum redundancy:
- Primary: Arweave (permanent, ~200 years)
- Secondary: IPFS (widely accessible via gateways)
- Tertiary: Nostr relays (decentralized distribution)

---

## Solution 4: Bitcoin Timelocks

**True decentralization using Bitcoin scripting**

### Concept

Use Bitcoin's `OP_CHECKLOCKTIMEVERIFY` (CLTV) to create time-locked transactions that become valid at a future date.

### How It Works

```
┌─────────────────┐
│  User Creates   │
│  Timelocked TX  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  TX Invalid     │────▶│  User Checks In │
│  Until Date X   │     │  (Invalidates)  │
└────────┬────────┘     └─────────────────┘
         │
         ▼ (Date X arrives)
┌─────────────────┐
│  TX Becomes     │
│  Valid & Broad- │
│  castable       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Recipient Gets │
│  Funds + Secret │
│  (via OP_RETURN)│
└─────────────────┘
```

### Implementation Approaches

**Approach A: Secret Hash in OP_RETURN**
```
TX Output 1: Small BTC to recipient (dust amount)
TX Output 2: OP_RETURN <encrypted_share_ipfs_cid>
Timelock: CLTV at deadline timestamp
```

When deadline passes, recipient broadcasts TX and gets the CID pointing to encrypted data on IPFS/Arweave.

**Approach B: Pre-signed Timelocked Transaction**
1. Create wallet with secret share as metadata
2. Create timelocked TX transferring to recipient
3. Sign TX but don't broadcast
4. Give signed TX to recipient
5. If user is alive: spend the UTXO (invalidates TX)
6. If user gone: recipient broadcasts after timelock

**Implementation:**
```typescript
// frontend/src/lib/bitcoin/timelock.ts
import * as bitcoin from 'bitcoinjs-lib';
import { ECPair } from 'ecpair';

export function createTimelockedTransaction(
  recipientAddress: string,
  utxo: UTXO,
  ipfsCid: string,
  locktime: number // Unix timestamp
): bitcoin.Transaction {
  const tx = new bitcoin.TransactionBuilder();

  // Set locktime (CLTV)
  tx.setLockTime(locktime);

  // Input with sequence that enables locktime
  tx.addInput(utxo.txid, utxo.vout, 0xfffffffe);

  // Output 1: Dust to recipient
  tx.addOutput(recipientAddress, 546);

  // Output 2: OP_RETURN with IPFS CID
  const data = Buffer.from(ipfsCid);
  const embed = bitcoin.payments.embed({ data: [data] });
  tx.addOutput(embed.output!, 0);

  return tx.build();
}
```

**Renewal Mechanism:**
- User must "check in" by spending the UTXO to a new address
- Create new timelocked TX pointing to new UTXO
- If user fails to renew, old TX becomes valid

### Limitations

- **6-month max recommended** due to cryptographic security concerns
- Requires Bitcoin wallet management
- More complex UX for non-crypto users
- Network changes could break old timelocks

### Sources
- [Bitcoin Timelocks Wiki](https://en.bitcoin.it/wiki/Timelock)
- [Bitcoin Optech Timelocks](https://bitcoinops.org/en/topics/timelocks/)
- [Dead Man's Switch Implementation](https://github.com/cercatrova21/bitcoin-dead-mans-switch)

---

## Solution 5: Ethereum Smart Contracts

### Concept

Deploy a smart contract that holds encrypted share references and releases them after deadline.

### Smart Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract KeyFateDeadMansSwitch {
    struct Secret {
        bytes32 encryptedShareHash;  // IPFS CID or Arweave TX ID
        address recipient;
        uint256 deadline;
        uint256 lastCheckIn;
        bool disclosed;
    }

    mapping(bytes32 => Secret) public secrets;
    mapping(address => bytes32[]) public userSecrets;

    event SecretCreated(bytes32 indexed secretId, address indexed owner, uint256 deadline);
    event CheckIn(bytes32 indexed secretId, uint256 newDeadline);
    event SecretDisclosed(bytes32 indexed secretId, bytes32 encryptedShareHash, address recipient);

    function createSecret(
        bytes32 secretId,
        bytes32 encryptedShareHash,
        address recipient,
        uint256 checkInInterval
    ) external {
        secrets[secretId] = Secret({
            encryptedShareHash: encryptedShareHash,
            recipient: recipient,
            deadline: block.timestamp + checkInInterval,
            lastCheckIn: block.timestamp,
            disclosed: false
        });
        userSecrets[msg.sender].push(secretId);
        emit SecretCreated(secretId, msg.sender, secrets[secretId].deadline);
    }

    function checkIn(bytes32 secretId, uint256 checkInInterval) external {
        Secret storage s = secrets[secretId];
        require(!s.disclosed, "Already disclosed");
        s.lastCheckIn = block.timestamp;
        s.deadline = block.timestamp + checkInInterval;
        emit CheckIn(secretId, s.deadline);
    }

    function disclose(bytes32 secretId) external {
        Secret storage s = secrets[secretId];
        require(block.timestamp > s.deadline, "Deadline not passed");
        require(!s.disclosed, "Already disclosed");
        s.disclosed = true;
        emit SecretDisclosed(secretId, s.encryptedShareHash, s.recipient);
    }

    // Chainlink Automation compatible
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        // Find secrets past deadline
        // Return true if any need disclosure
    }

    function performUpkeep(bytes calldata performData) external {
        // Disclose secrets identified in checkUpkeep
    }
}
```

### Automation with Chainlink Keepers

Use [Chainlink Automation](https://chain.link/automation) to automatically call `disclose()` when deadline passes:
- No manual intervention needed
- Decentralized trigger mechanism
- Gas costs covered by user prepayment (LINK tokens)

### Integration with Sarcophagus

Rather than building from scratch, consider integrating with [Sarcophagus](https://ethglobal.com/showcase/dead-man-s-switch-qfeyv):
- Ethereum for logic
- Arweave for storage
- Archaeologist network for triggering
- Already audited and production-tested

---

## Solution 6: Multi-Party Custody Network

### Concept

Distribute encrypted shares to multiple independent custodians who collectively ensure disclosure.

```
┌─────────────────┐
│   User Secret   │
└────────┬────────┘
         │
         ▼ (Split via SSS)
┌────────┴────────┐
│   Custodian 1   │──┐
├─────────────────┤  │
│   Custodian 2   │──┼──▶ Threshold Recovery
├─────────────────┤  │
│   Custodian 3   │──┘
└─────────────────┘
```

### Implementation

1. **Custodian Network**: Independent services that agree to hold shares
2. **Check-in Protocol**: User checks in with all custodians
3. **Disclosure Trigger**: M-of-N custodians must agree deadline passed
4. **Byzantine Fault Tolerance**: System works even if some custodians fail

### Potential Custodians

- Other dead man's switch services (federation)
- Decentralized identity providers
- Trusted non-profits (EFF, etc.)
- Friend/family-run nodes

### Protocol Design

```typescript
interface CustodianProtocol {
  // User registration
  registerSecret(secretId: string, encryptedShare: string, deadline: Date): Promise<void>;

  // User check-in
  checkIn(secretId: string, signature: string): Promise<void>;

  // Recipient query
  queryStatus(secretId: string): Promise<{ disclosed: boolean; share?: string }>;

  // Disclosure (after deadline)
  requestDisclosure(secretId: string, proof: DeadlineProof): Promise<string>;
}
```

---

## Solution 7: Email-Based Time Capsule

### Concept

Use scheduled email services as a backup disclosure mechanism.

### Implementation

1. Create scheduled email with third-party service
2. Email contains encrypted share + recovery instructions
3. User must cancel/reschedule to "check in"
4. If not cancelled, email sends automatically

### Services

- [FutureMe](https://www.futureme.org/) - Free email scheduling
- [Boomerang](https://www.boomeranggmail.com/) - Gmail integration
- [FollowUpThen](https://www.followupthen.com/) - Email reminders

### Limitations

- Depends on third-party email services
- Less secure than cryptographic solutions
- User must remember to reschedule
- Service could shut down

---

## Recommended Hybrid Architecture

Combine multiple approaches for maximum resilience:

```
                    ┌─────────────────────────────────────┐
                    │          KeyFate Platform           │
                    │  (Primary - works when available)   │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Export Kit     │     │  Nostr Relays   │     │   Arweave       │
│  (User holds)   │     │  (Distributed)  │     │  (Permanent)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │    Standalone Recovery Tool         │
                    │  (Works with any share source)      │
                    └─────────────────────────────────────┘
```

### Layer 1: Export Kit (Free Tier)
- Every user gets recovery kit download
- Works completely offline
- User responsibility to store securely

### Layer 2: Nostr Integration (Free Tier)
- Publish to 5+ recommended relays
- Censorship-resistant distribution
- Aligns with existing roadmap

### Layer 3: Arweave/IPFS (Pro Tier)
- Permanent storage guarantee
- One-time cost absorbed or passed to user
- Premium resilience feature

### Automatic Disclosure (Pro Tier)
For automatic disclosure without KeyFate:
1. **Nostr Oracle Bots**: Multiple bots monitor check-in status
2. **Sarcophagus Integration**: Leverage existing infrastructure
3. **Smart Contract Trigger**: Ethereum/Chainlink Keepers

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| User loses export kit | Store on multiple cloud services, provide reminders |
| Nostr relays go offline | Use 5+ relays, verify persistence periodically |
| Arweave economics change | Store on multiple networks as backup |
| Bitcoin timelock complexity | Only offer to advanced users |
| Smart contract bugs | Use audited solutions like Sarcophagus |
| Recipient lacks technical skill | Provide guided recovery tool |

---

## Migration Plan

### Phase 1: Export System (Weeks 1-2)
1. Build recovery kit generator
2. Create standalone recovery HTML tool
3. Add export button to secret details page
4. Test offline recovery flow
5. Deploy to production

### Phase 2: Nostr Integration (Weeks 3-6)
1. Add nostr-tools dependency
2. Generate Nostr keypairs for users (optional)
3. Publish encrypted shares to relays on secret creation
4. Build relay monitoring for recipients
5. Create Nostr-based recovery flow

### Phase 3: Decentralized Storage (Weeks 7-10)
1. Integrate with IPFS (Pinata or Web3.Storage)
2. Add Arweave upload for Pro tier
3. Evaluate Sarcophagus integration
4. Store CIDs in recovery kit and Nostr events

### Phase 4: Automatic Triggers (Weeks 11-14)
1. Deploy Nostr oracle bot(s)
2. Create smart contract for check-in tracking
3. Integrate Chainlink Automation (or Sarcophagus)
4. Test end-to-end automatic disclosure

### Phase 5: Bitcoin Timelocks (Future)
1. Design wallet integration UX
2. Implement CLTV transaction creation
3. Build renewal workflow
4. Deploy as opt-in advanced feature

---

## Open Questions

1. **Nostr Identity**: Should users be required to have a Nostr identity, or should KeyFate manage keys on their behalf?

2. **Cost Model**: Who pays for Arweave/IPFS storage - KeyFate (absorbed into subscription) or users (pass-through)?

3. **Sarcophagus vs Custom**: Should we integrate with Sarcophagus or build our own smart contract system?

4. **Recovery UX**: How technical can we expect recipients to be? Should recovery work via mobile browser?

5. **Oracle Trust**: How many independent oracle bots do we need for reliable automatic disclosure?
