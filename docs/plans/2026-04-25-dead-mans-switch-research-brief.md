# Dead Man’s Switch Research Brief

## Purpose

This document is intended as a **handoff brief for a separate LLM or researcher**.
Its goal is to capture the current state, the desired future state, the hard
constraints, and the relevant technical context for researching a more secure
and resilient dead-man’s-switch design.

This document is intentionally focused on **problem framing**, not solution
selection. It should encourage **orthogonal research** across multiple design
directions rather than anchoring too early on one implementation path.

---

## Product Context

The product is **KeyFate**, a dead-man’s-switch system for sensitive digital
secrets.

The intended user experience is:

- a user stores sensitive disclosure material
- the user periodically checks in
- every successful check-in resets the release timer
- if the user stops checking in, the system eventually triggers disclosure
- a designated recipient can recover the material

The system is intended for sensitive digital information such as:

- private recovery information
- sensitive documents
- instructions
- other secret material

This is **not primarily a Bitcoin custody / funds movement system**. If Bitcoin
is used, it is only as a timing, signaling, or anchoring primitive.

---

## Current State

### Application architecture

The current codebase is a SvelteKit 5 application with:

- SvelteKit 5 frontend
- PostgreSQL + Drizzle ORM
- Auth.js authentication
- in-process cron scheduler for reminders, checks, and disclosure operations

### Secret handling model

The current model uses **Shamir’s Secret Sharing** client-side.

Typical flow:

- the secret is split in the browser
- a threshold scheme such as `2-of-3` is used
- one share is held by the server
- other shares are held or staged elsewhere for recovery

### Current recovery / disclosure paths in code

The codebase currently includes four disclosure/recovery paths:

1. **Server path**
   - the server stores one share
   - upon trigger, the server can disclose/send its share

2. **Nostr path**
   - encrypted shares are published to Nostr relays
   - recipient Nostr pubkeys can be associated with recipients
   - current implementation uses NIP-44 / NIP-59 style patterns

3. **Bitcoin path**
   - a Bitcoin CSV timelock flow exists
   - a timelock UTXO and pre-signed recipient transaction are created
   - OP_RETURN currently carries recovery-related data

4. **Passphrase path**
   - there is also a passphrase-based recovery path

### Current timing / trigger behavior

The current dead-man’s-switch behavior is:

- user sets a check-in interval
- user check-in pushes the deadline forward
- failure to check in leads to escalating reminders and eventual disclosure
- there is support for pause/resume, failed-secret recovery, and “send now”

---

## Current Problems

The current system does not cleanly satisfy the combination of:

- secrecy before release
- time-based release
- recipient exclusivity
- automation
- resilience if the server operator disappears

### Problem 1: Nostr currently weakens pre-release secrecy

The current Nostr integration makes relevant encrypted events too discoverable
before the intended release time.

Why this matters:

- if a recipient can find the relevant Nostr events early
- and if they also possess sufficient recovery material
- then they may be able to recover earlier than intended

This means the current Nostr path is helpful for **distributed storage**, but is
weak for **strict release timing secrecy**.

### Problem 2: Bitcoin currently weakens confidentiality

The current Bitcoin flow places recovery-related data in OP_RETURN.

Why this matters:

- Bitcoin data is public
- OP_RETURN contents are public once revealed
- if key material or overly powerful recovery material is embedded there, public
  disclosure becomes a risk

This means the current Bitcoin path behaves too much like a **public disclosure
mechanism**, not a clean timing primitive.

### Problem 3: Bitcoin timelocks do not inherently provide secrecy

Bitcoin CSV enforces **when a transaction becomes valid to spend**, but not
**who can learn or parse the transaction contents** if the raw transaction or
related recovery artifacts are already known.

This creates a key issue:

- if the recipient has the raw recovery transaction before maturity
- they may be able to learn the embedded pointer or recovery metadata early

So Bitcoin can delay spendability, but does not by itself guarantee delayed
knowledge of recovery material.

### Problem 4: Nostr has no native timed-read primitive

Nostr can provide:

- encryption to recipient public keys
- relay-based distribution
- some metadata-hiding patterns

But it does **not** natively provide:

- a guarantee that a recipient cannot decrypt until a future time

There is no known standard Nostr primitive that directly enforces “this message
exists but cannot be read until time T.”

### Problem 5: Nostr retention and exact-ID retrieval are not guaranteed

Public relays may:

- not store wrapped/private events reliably
- delete or expire them
- refuse to serve them later

So any design that assumes “the ciphertext will be there later if we know the
ID” must account for relay durability problems.

### Problem 6: Bitcoin timing is approximate, not exact

Bitcoin CSV is based on UTXO age / confirmations and block production, not a
precise wall-clock release time.

This means:

- release timing is approximate
- any user-facing promise of exact release time is misleading
- practical UX should assume uncertainty windows and block-height progress

### Problem 7: There is an inherent tension between secrecy, timing, and operator independence

This is the central problem.

If enough material is pre-staged outside the operator’s server so recovery still
works when the operator disappears, then:

- either the recipient may learn too much too early
- or a public release mechanism reveals too much
- or a stronger timed-release cryptographic primitive is required

---

## Desired Future State

The target system should ideally satisfy **all** of the following.

### 1. Strong secrecy before release

Before the trigger condition is satisfied:

- the intended recipient should not be able to recover the secret
- third parties should not be able to recover the secret
- discovery of the relevant ciphertext location should ideally be difficult
- metadata leakage should be minimized

This is stronger than “encrypted storage.” It requires genuine resistance to
**early recovery by the intended recipient**.

### 2. Time-based release reset by check-in

The system should support:

- a release timer
- periodic user check-ins
- timer reset upon successful check-in
- eventual disclosure when check-ins stop

This should behave as a renewable dead-man’s switch.

### 3. Automation

The desired system is not purely manual.

It should automatically:

- track deadlines
- reset the release window on check-in
- trigger release when the user stops checking in
- notify the recipient appropriately
- minimize manual intervention during normal operation

### 4. Resilience if the server operator is gone

This is critical.

The system should ideally remain functional if:

- the service shuts down
- the operator disappears
- the operator becomes unavailable or is seized

The challenge is to preserve this resilience **without sacrificing secrecy or
allowing early recipient access**.

### 5. Recipient exclusivity at release time

At release time:

- only the intended recipient should be able to decrypt the release package
- public observers should not gain usable secret material
- if there is a public release signal, it should reveal as little as possible

### 6. Very simple UX

The design must be usable by non-technical people.

Recipients should not need to understand:

- Bitcoin internals
- Nostr internals
- OP_RETURN
- event IDs
- relay topology
- transaction parsing
- raw hex formats

The ideal UX uses abstractions like:

- Recovery Key
- Unlock Timer
- Recovery Package

and keeps protocol details hidden unless explicitly requested.

---

## Simplifying Assumption for Research

For the next phase of research, it is acceptable and preferred to assume a
**single-recipient model**.

This simplifies analysis by removing:

- multi-recipient routing complexity
- recipient-to-recipient metadata leakage
- multi-party manifest design
- threshold coordination among multiple recipients

The research target can therefore be framed as:

- one sender / one protected secret
- one intended recipient
- one recipient-specific release flow

Any solution can later be generalized if it proves sound.

---

## Hard Constraints

### Constraint A: This is not about storing money on Bitcoin

If Bitcoin is used at all:

- it should use the minimum practical amount
- it is not acting as a treasury or funds vault
- it is only acting as a timing, signaling, anchoring, or trigger primitive

Research should not assume this is a Bitcoin inheritance-of-funds product.
It is a **timed release of secret material** problem.

### Constraint B: Secrecy and timing are both paramount

The highest priority properties are:

1. the recipient cannot read early
2. the recipient can read after the trigger condition is satisfied
3. the release remains recipient-exclusive
4. operator disappearance should not break the system if possible

Any design that sacrifices either **pre-release secrecy** or **time-based
release control** should be treated as an incomplete fit.

### Constraint C: Nostr alone does not solve timed readability

Nostr can be used for:

- encrypted storage
- decentralized distribution
- recipient-specific encryption

But the current understanding is that Nostr does **not** by itself enforce
future-time readability.

Research should verify whether any Nostr-adjacent or ecosystem pattern exists,
but should not assume a built-in standard already solves this.

### Constraint D: Bitcoin alone does not solve secrecy

Bitcoin timelocks provide:

- spendability constraints
- public chain signaling
- approximate timing

But they do not by themselves provide:

- ciphertext confidentiality
- hidden-pointer secrecy once recovery artifacts leak
- recipient-only read guarantees

### Constraint E: UX must remain plausible for ordinary users

Even if a cryptographic design is elegant, it must still be implementable in a
way that is realistic for:

- a normal user creating the secret
- a non-technical recipient recovering it later

This includes:

- setup simplicity
- backup clarity
- understandable notifications
- guided recovery with minimal jargon

---

## Previously Explored Design Direction

A design direction already considered was:

1. publish encrypted material to Nostr without easily searchable recipient tags
2. store only a manifest pointer or event ID in a Bitcoin-based release path
3. reveal the pointer after Bitcoin timelock expiry
4. require the recipient’s Nostr private key to decrypt the material

This direction is relevant because it attempts to separate:

- **Bitcoin as timing/pointer reveal**
- **Nostr as encrypted storage**
- **recipient Nostr private key as decryption authority**

However, it still leaves a major unresolved issue:

- if the recipient already possesses the raw recovery transaction or any
  equivalent artifact containing the pointer, then they may learn that pointer
  early
- Bitcoin CSV delays spendability, not knowledge of transaction contents

This means the design is an improvement over the current state, but not a full
resolution of the core timing-secrecy problem.

---

## Research Axes To Explore Independently

The next researcher / LLM should treat the following as **orthogonal axes of
investigation**, not as a single preselected architecture.

### Axis 1: Bitcoin as timing primitive

Research questions:

- Does Bitcoin add meaningful value for timed secret release when no money is
  being stored?
- Can Bitcoin safely act as only a public signal / trigger / anchor?
- What are the leakage risks if recovery artifacts are pre-distributed?
- Can Bitcoin’s approximate timing and public nature fit the secrecy goals?

### Axis 2: Nostr as storage / delivery layer

Research questions:

- Can Nostr be used as a durable encrypted storage layer for this use case?
- What retention strategies are needed?
- Are there Nostr patterns beyond standard NIP-59 gift wrap that better support
  low-discoverability storage?
- Is there any Nostr or ecosystem pattern that approximates delayed
  discoverability or delayed decryption?

### Axis 3: Timed-release cryptography

Research questions:

- Are there practical timed-encryption schemes that enforce future readability?
- What exists in:
  - timelock encryption
  - threshold encryption
  - VDF-based timed release
  - public randomness beacons
  - distributed key-release systems
- Which are realistic for a product with ordinary users?

### Axis 4: Trusted or semi-trusted release systems

Research questions:

- Can secrecy and timing be better achieved with server-held delayed key release?
- What about quorum-based release systems?
- What are the tradeoffs between:
  - one trusted operator
  - multiple operators / threshold custodians
  - legal / human escrow
- How much operator dependence is acceptable if secrecy and timing become much
  stronger?

### Axis 5: Recovery-key UX

Research questions:

- How should recipient credentials be represented?
- Should the system expose raw Nostr keys or wrap them in a product-specific
  Recovery Key abstraction?
- How should backup / restore work for a non-technical recipient?
- How should the recipient be notified before and at release time?

### Axis 6: Operator disappearance model

Research questions:

- What exactly must survive the operator disappearing?
- Which artifacts can be safely pre-distributed, and which cannot?
- Can the system tolerate:
  - the operator disappearing before trigger
  - the operator disappearing after trigger
  - the operator never being available again?
- Which designs fail closed versus fail open?

---

## Concrete Suggested Technologies / Domains To Investigate

These are not selections or recommendations. They are **relevant technical
areas** that appear applicable and should be researched independently.

### Bitcoin-related

- BIP-68 / BIP-112 relative timelocks (CSV)
- BIP-125 replace-by-fee implications for unconfirmed recovery transactions
- pre-signed transaction leakage models
- BIP-128 timelock-recovery concepts and alert/recovery transaction patterns
- public chain anchoring vs private secret release tradeoffs

### Nostr-related

- NIP-44 encryption
- NIP-59 gift wrap
- relay retention / exact-ID retrieval limitations
- relay auth / private relay patterns
- nonstandard low-discoverability event publication strategies
- managed relay sets vs public relay sets

### Cryptographic timed-release / delayed-decryption domains

- timelock encryption
- witness encryption
- verifiable delay functions (VDFs)
- threshold encryption
- distributed key release
- public randomness beacons (e.g. drand-like systems)
- proxy re-encryption / delayed re-encryption models

### Operational / system design domains

- quorum-based secret release
- human escrow / legal escrow with automation hooks
- key sharding among operators
- failure-tolerant notification systems
- offline-capable decryption UX

---

## Critical Open Problem

The central unresolved issue to investigate is:

> If release must still work when the operator is gone, where does the timed-release decryption capability live before release, and why can’t the recipient get it early?

Everything else is downstream of that.

This is the primary question the next researcher / LLM should treat as the core
problem.

---

## Research Goal Statement

The next researcher / LLM should investigate architectures that could enable a
single-recipient dead-man’s-switch system with all of the following properties:

- strong secrecy before release
- time-based release reset by check-in
- automated behavior
- recipient-exclusive decryption at release time
- resilience if the server/operator disappears
- realistic UX for non-technical users

The output should compare **multiple orthogonal design families**, not assume in
advance that Bitcoin or Nostr must remain part of the final design.