# Private Nostr + Bitcoin Manifest Disclosure Design

## Context

The current hybrid disclosure flow has two real security problems:

1. **Nostr events are too discoverable too early.** The current gift-wrap flow uses a
   recipient `p` tag, so a recipient with their Nostr private key can search for
   addressed events before the intended disclosure time.
2. **Bitcoin OP_RETURN reveals too much.** The current Bitcoin recovery path places
   the symmetric key material on-chain, which makes timed disclosure public rather
   than recipient-exclusive.

That is backwards. Bitcoin should control **when** a recipient can discover the
location of the disclosure material. Nostr should control **who** can decrypt the
material. The current design mixes those responsibilities and weakens both.

This document proposes a replacement flow:

- publish encrypted disclosure material to Nostr without recipient-identifying tags
- publish a separate encrypted manifest for multiple recipients
- reveal only the manifest event ID via the Bitcoin timelock path
- require the recipient's Nostr private key to decrypt the manifest and then the
  underlying share payloads

## Goals

- Prevent practical early discovery of the relevant Nostr payloads by recipients.
- Keep Bitcoin's role limited to **timed discovery**, not public key disclosure.
- Support multiple recipients cleanly.
- Preserve recovery if the KeyFate server disappears.
- Make the recipient UX simple enough for non-technical people.
- Allow email notifications without putting secret material in email.

## Non-Goals

- Hiding all metadata from a global adversary watching every Nostr relay.
- Guaranteeing storage forever on third-party relays without replication.
- Replacing email with a cryptographic transport layer.
- Solving legal proof-of-death or identity verification in this phase.

## Core Design

### Summary

For each secret, KeyFate prepares:

1. **Recipient payload events** on Nostr
   - each payload contains one encrypted share or recipient-specific recovery
     package
   - each payload is encrypted to the recipient's Nostr public key
   - each payload is published without recipient-identifying tags
2. **One encrypted manifest event** on Nostr
   - the manifest lists the recipient payload event IDs and relay hints
   - the manifest may be per-recipient or a single encrypted blob containing
     entries for multiple recipients
   - the manifest is encrypted to each recipient's Nostr public key or split into
     recipient-specific encrypted sections
3. **A Bitcoin timelock UTXO and recipient transaction**
   - the OP_RETURN contains only a compact manifest pointer bundle
   - no symmetric share key is ever placed on-chain

At disclosure time, Bitcoin reveals the manifest event ID. The recipient uses
that pointer to fetch the manifest from Nostr, decrypts it with their Nostr
private key, then follows the manifest to fetch and decrypt their actual payload.

## Protocol Roles

### Bitcoin

Bitcoin provides **public timed release of a pointer**.

It does **not** provide secrecy. Everyone can see the OP_RETURN after the
recovery transaction is revealed. That is fine because the OP_RETURN contains
only:

- manifest event ID
- optional manifest hash/version
- optional relay set identifier or small relay hint digest

Bitcoin therefore answers only one question:

> When does the world learn which Nostr object matters?

### Nostr

Nostr provides **distributed ciphertext storage**.

It does **not** enforce timing on its own. The encrypted events exist before the
trigger, but they are not easily discoverable because:

- payload events are not tagged to recipients
- the manifest event ID is withheld until the Bitcoin path reveals it
- the recipient payload event IDs are inside the encrypted manifest, not public
  in advance

Nostr therefore answers two questions:

> Where is the ciphertext stored?
> Who can decrypt it?

### Recipient Nostr Key

The recipient's Nostr private key provides **exclusive decryption**.

Even after the Bitcoin path reveals the manifest event ID, only the intended
recipient should be able to decrypt the manifest contents and learn the payload
locations and recovery instructions.

## Data Model

### Recipient Payload Event

Each recipient payload event contains encrypted recipient-specific content such
as:

- one Shamir share
- share metadata
- recovery instructions specific to that recipient
- optional backup channel references

Recommended structure before encryption:

```json
{
  "version": 1,
  "secretId": "uuid",
  "recipientId": "uuid",
  "shareEventType": "share",
  "shareIndex": 2,
  "threshold": 2,
  "totalShares": 3,
  "encryptedShare": "...",
  "nonce": "...",
  "createdAt": "ISO-8601"
}
```

This object is encrypted to the recipient's Nostr public key and published as an
opaque event with no recipient tag.

### Manifest Event

The manifest must be the only object referenced from Bitcoin.

Recommended plaintext structure before encryption:

```json
{
  "version": 1,
  "secretId": "uuid",
  "recipientId": "uuid",
  "payloadEvents": [
    {
      "eventId": "<nostr-event-id>",
      "relayHints": ["wss://relay1", "wss://relay2"],
      "kind": 21059,
      "contentHash": "<hash>"
    }
  ],
  "instructions": {
    "threshold": 2,
    "totalShares": 3,
    "nextStep": "Fetch payload event(s) and decrypt with this Nostr key"
  }
}
```

For multiple recipients, use **recipient-specific encrypted manifest entries**.
Do not put every recipient's payload IDs into one plaintext manifest that one
recipient can decrypt. That would leak other recipients' event IDs.

Recommended practical model:

- one **manifest root event** referenced by Bitcoin
- root event contains a small envelope with encrypted entries keyed by
  recipient identifier
- after decrypting their entry, each recipient learns only their own payload
  event IDs and relay hints

If that proves too complex for v1, use **one manifest event per recipient** and
store that recipient-specific manifest event ID in that recipient's Bitcoin
recovery path.

## How the Bitcoin Timelock Prevents Early Location Disclosure

This is the critical point.

### What Bitcoin does not do

Bitcoin does **not** hide data perfectly. Once a transaction is on-chain, its
OP_RETURN is public.

### What Bitcoin does do in this design

Bitcoin delays publication of the **manifest pointer** until the recipient path
becomes spendable.

The intended sequence is:

1. KeyFate creates encrypted Nostr events ahead of time.
2. KeyFate records the manifest event ID privately.
3. KeyFate creates a pre-signed recipient recovery transaction whose OP_RETURN
   contains that manifest event ID.
4. That recovery transaction is not valid until the CSV timelock expires.
5. Before expiry, the recipient cannot broadcast the transaction, so the
   manifest pointer is not published on-chain.
6. After expiry, the recipient can broadcast it or otherwise obtain the raw
   transaction, extract the manifest event ID, then fetch the manifest.

The privacy guarantee is therefore not:

> Nobody can ever know the pointer.

It is:

> The pointer is not publicly disclosed by the Bitcoin path before the timelock.

That is good enough **only if KeyFate also keeps the manifest event ID secret**.
The scheme fails if the manifest event ID leaks elsewhere through:

- logs
- analytics
- browser localStorage
- support tooling
- debug APIs
- exported recovery kits issued before disclosure

So the design requirement is blunt:

**Treat manifest event IDs as secret pre-disclosure material.**

## Why This Is Better Than the Current Flow

### Current flow

- Nostr `p` tag makes recipient discovery easy before release.
- Bitcoin OP_RETURN reveals key material publicly.

### Proposed flow

- Nostr ciphertext exists early but is not trivially discoverable.
- Bitcoin reveals only where to look, not how to decrypt.
- Recipient Nostr private key controls decryption.

That is a cleaner division of labor and matches the product story better.

## Multi-Recipient Design

### Requirement

Multiple recipients are desirable, but each recipient should only learn:

- their own payload event IDs
- their own recovery instructions
- only the metadata strictly needed to reconstruct the secret in the intended
  threshold model

### Recommended model

For a 2-of-3 scheme with owner backup, KeyFate share, and two recipients:

- server holds one share in the normal path
- each recipient gets one recipient-specific Nostr payload event
- each recipient gets one recipient-specific manifest entry
- Bitcoin reveals only the manifest root pointer
- after decrypting their manifest entry, recipient A cannot see recipient B's
  payload IDs unless explicitly intended

### Manifest entry format

Each recipient entry can be encrypted to that recipient pubkey and include:

- recipient payload event IDs
- relay hints
- secret title alias safe for display
- recovery checklist
- optional contact/support text

## Threat Model

### Defended reasonably well

- **KeyFate server shutdown after setup**
  - recipient can still recover using Bitcoin pointer + Nostr ciphertext
- **Observers reading Bitcoin chain**
  - they learn the manifest pointer after expiry but cannot decrypt without the
    recipient's Nostr private key
- **Recipients searching relays early by pubkey**
  - removed if payloads/manifests are not tagged to their pubkey

### Not fully solved

- **Manifest ID leaked pre-disclosure**
  - recipient can recover early if they learn the pointer through another path
- **Global relay observer correlating publications**
  - metadata leakage still exists
- **Relay data loss**
  - recovery fails if ciphertext is no longer available on enough relays
- **Recipient loses their Nostr private key**
  - they cannot decrypt unless a separate fallback path exists

## Relay Persistence Strategy

This design only works if the ciphertext is still there later.

Minimum requirements:

- publish to at least 5 relays, preferably more
- warn if fewer than 3 relays accept the event
- periodically republish while the secret remains active
- store relay acceptance receipts in the database
- include relay hints in the manifest entry
- allow recipients to add custom relays to their recovery search

Optional stronger approach:

- publish identical ciphertext to a managed relay set plus public relays
- periodically audit retrievability by exact event ID without decrypting content

## UX Design for Non-Technical Recipients

The UX must assume the recipient does not understand:

- Bitcoin timelocks
- Nostr keys
- event IDs
- OP_RETURN
- relay selection

They need a boring wizard.

### Recipient onboarding

When the owner sets up a recipient, KeyFate should guide them through one of two
models:

#### Model A: KeyFate-managed Nostr identity for the recipient

Not recommended unless the custody story is explicit. It simplifies UX but
creates a dangerous escrow/custody problem.

#### Model B: Recipient-generated Nostr key with a recovery package

Recommended.

Flow:

1. Recipient receives an invitation email.
2. They click a guided setup link.
3. The browser generates a Nostr keypair locally.
4. They are shown:
   - a human explanation of what this key is for
   - a one-click download of an encrypted backup file
   - a printable recovery sheet
   - a strong warning not to share the private key
5. Their public key is saved to the secret recipient record.

For non-technical users, the UI should call it something like:

- **Recovery Key** instead of Nostr private key
- **Recipient ID** instead of pubkey

But the underlying cryptography remains Nostr-compatible.

### Email notifications

Email is for **notification**, not secrecy.

The notification email should include:

- that the recipient has been designated for a secure future disclosure
- the secret label in user-friendly form, if the owner allows it
- the estimated unlock date and time
- the current Bitcoin transaction ID or watch link
- the expected unlock block height or approximate block window
- a link to a simple recovery page
- a reminder to keep their Recovery Key and backup file safe

Email must **not** include:

- manifest event ID before disclosure
- ciphertext payloads
- any private key material
- any Shamir share

### Pre-disclosure reminder emails

If the owner wants, KeyFate can send periodic reminders to recipients like:

- "You are listed as a recovery recipient for a secure disclosure."
- "Estimated unlock date: May 12, 2026."
- "Keep your Recovery Key available."

That reduces surprise without leaking the actual recovery pointer.

### Disclosure-time email

When the timelock is believed to be close or already mature, send a plain email:

- the disclosure is now available
- open the recovery page
- bring your Recovery Key backup file or Recovery Key phrase
- if Bitcoin is still syncing or not yet mature, wait for the block counter shown

Again: no pointer material by email if avoidable. The recovery page should fetch
or derive it using the recipient's authenticated local recovery workflow.

## Simple Recovery UX

### Recovery page principles

The recovery page must feel like:

1. identify yourself
2. check whether the disclosure is unlocked
3. unlock the package
4. download or view clear next steps

Not like a blockchain debugger.

### Recommended recovery flow

#### Step 1: Open recovery page

The recipient opens `keyfate.com/recover` or an offline-capable equivalent.

#### Step 2: Import Recovery Key

Offer three choices:

- paste Recovery Key
- upload encrypted backup file
- scan printable backup QR code

The UI should avoid showing raw `nsec` unless the user enters advanced mode.

#### Step 3: Check unlock status

The page asks for:

- a recovery reference code from email, or
- a secret-specific recovery link token, or
- a local recovery package file

The page then shows:

- current Bitcoin block height
- required unlock height
- status: `Locked`, `Unlocking`, or `Ready`
- approximate remaining time in plain language

#### Step 4: Retrieve manifest pointer

When ready, the page:

- parses the recovery transaction or chain data
- extracts the manifest event ID
- fetches the manifest from relay hints or default relays

None of this should be exposed as raw event IDs unless the user expands a
technical details section.

#### Step 5: Decrypt manifest and payload

The page uses the imported Recovery Key locally to:

- decrypt the manifest entry
- fetch recipient payload event(s)
- decrypt the payload(s)
- present the recovered share and next instructions

#### Step 6: Human instructions

After decryption, show a calm checklist such as:

1. "Your recovery package is ready."
2. "Download your share file."
3. "Contact the other designated person if needed."
4. "Use the guided combine tool to reconstruct the secret."

Do not dump hex unless requested.

## Recommended Product Abstractions

To keep the UX simple, the product should rename concepts:

- `Nostr private key` → `Recovery Key`
- `nsec backup` → `Recovery Key Backup`
- `Bitcoin timelock` → `Unlock Timer`
- `manifest event` → hidden internal term; do not expose by default
- `relay` → `network location`, only in advanced details

This is honest enough while still being usable.

## Operational Requirements

- Manifest event IDs must be encrypted or otherwise kept out of normal logs.
- Recovery kits generated before disclosure must not contain pre-disclosure
  manifest pointers unless explicitly intended as an owner-controlled override.
- The recovery page should support offline-capable decryption after initial load.
- Every published Nostr event should be replicated and audited for availability.
- The system should support rotation if a recipient changes their Recovery Key
  before disclosure.

## Open Questions

1. Should v1 use one manifest event per recipient instead of a multi-recipient
   manifest root to reduce complexity?
2. How should recipients rotate or revoke a Recovery Key without forcing full
   secret recreation?
3. Do we want a passphrase fallback for recipients who lose their Recovery Key,
   or is that just reintroducing complexity and support risk?
4. Should the disclosure-time email include a watch-only Bitcoin link, or is
   that too confusing for non-technical users?
5. Do we need a managed archival relay under KeyFate control to increase
   retrieval reliability without making the system depend on the server?

## Recommendation

Build this in two stages.

### Stage 1

- remove recipient `p`-tag discoverability from the recovery path
- stop placing key material on-chain
- move to `Bitcoin reveals manifest pointer only`
- use one manifest event per recipient
- build a non-technical Recovery Key setup and recovery wizard

### Stage 2

- add manifest root / multi-recipient envelope optimization
- add relay retrievability audits and republishing
- add recipient key rotation and richer fallback handling

Stage 1 fixes the real security story. Stage 2 adds scale and polish.