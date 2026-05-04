# OpenSats project brief

## Project

**KeyFate:** open-source dead man's switch infrastructure for Bitcoin self-custody inheritance, emergency wallet recovery, and operational continuity.

## Why this fits OpenSats

Bitcoin self-custody fails if heirs, collaborators, or emergency contacts cannot recover funds when a key holder dies, is detained, or loses capacity. Many users respond by custodializing funds, storing seed phrases in unsafe places, or relying on proprietary estate vendors. KeyFate aims to make a safer open-source alternative available.

## Bitcoin and open-source relevance

KeyFate supports the Bitcoin ecosystem by improving self-custody survivability:

- Protects wallet recovery instructions, seed material references, multisig coordinator details, and inheritance runbooks.
- Keeps the service from learning the underlying secret through client-side encryption and secret sharing.
- Can support recipient recovery without proprietary custody or trusted legal intermediaries.
- Roadmaps Nostr-backed disclosure for decentralized delivery.

## Requested funding theme

An OpenSats grant should fund self-custody continuity primitives:

1. Offline recovery package and verification docs for Bitcoin heirs.
2. Hardening of encrypted share creation, storage, and reconstruction flows.
3. Nostr disclosure delivery for relay-based resilience.
4. Security test coverage for false disclosure, replay, share tampering, and account takeover.

## Deliverables

- 12-16 week milestone plan with tested checkpoints.
- Public threat model scoped to Bitcoin users and high-risk operators.
- Recipient guide for recovering wallet instructions without uploading secrets to third parties.
- Nostr disclosure documentation and implementation progress report.
- Audit-ready test suite for disclosure-critical logic.

## Impact metric

A Bitcoin holder can create a recovery plan that preserves self-custody during life, gives chosen recipients a realistic path after incapacity, and avoids entrusting plaintext seed material to KeyFate or a third-party custodian.
