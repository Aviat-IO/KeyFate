# NLnet project brief

## Project

**KeyFate:** user-controlled emergency disclosure infrastructure for encrypted secrets, recipient recovery, and decentralized delivery.

## Why this fits NLnet

NLnet supports an open internet where users retain agency, privacy, and interoperability. KeyFate contributes by making emergency access to important information possible without surrendering plaintext data to a platform operator.

## Public-interest value

KeyFate addresses a common failure in digital life: critical credentials, documents, and instructions are often locked behind one person's account, device, or legal jurisdiction. The project advances:

- **User autonomy:** users define check-in cadence, recipients, and disclosure conditions.
- **Privacy by design:** the service should not need plaintext secrets to perform disclosure.
- **Interoperability:** recovery artifacts and Nostr disclosure events should be documented enough for independent tooling.
- **Resilience:** recipients should have a path when email, hosting, or a central web app is unavailable.

## Requested funding theme

An NLnet grant should fund open, reviewable infrastructure:

1. Specification of recovery bundle formats and disclosure state machine.
2. Implementation of interoperable Nostr disclosure artifacts.
3. Offline recipient recovery tooling and documentation.
4. Public threat model and security review preparation.

## Deliverables

- Open documentation for secret lifecycle, recipient lifecycle, and disclosure lifecycle.
- Threat model with assets, actors, trust boundaries, attack paths, mitigations, and residual risks.
- Recovery bundle format suitable for independent implementations.
- Test vectors or fixtures for encrypted disclosure events and share reconstruction where feasible.
- Project report mapping completed work to user rights: privacy, portability, resilience, and agency.

## Impact metric

A third-party implementer or auditor can read the repository, understand the recovery protocol, build compatible tooling, and verify that emergency disclosure does not depend on a closed vendor stack.
