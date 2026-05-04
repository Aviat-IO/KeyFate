# 12-16 week grant milestone plan

This plan assumes one primary maintainer with external review support. It is scoped for funders who want concrete freedom-tech deliverables rather than generic product growth.

## Milestone 1: Security baseline and disclosure invariants (weeks 1-3)

**Goal:** define and test the minimum security properties before expanding delivery channels.

Deliverables:

- Freeze the documented disclosure state machine: active, reminder due, overdue, triggered, disclosed, failed, recovered, deleted.
- Add regression tests for false-trigger prevention, retry behavior, idempotent disclosure, and recipient authorization checks.
- Document what KeyFate stores, what it cannot read, and what data remains sensitive even when encrypted.
- Add operator runbooks for incident response, disclosure pause, database backup restore, and secret deletion.

Acceptance evidence:

- Threat model published in-tree.
- Automated tests cover disclosure-critical state transitions.
- Runbooks link from project docs.

## Milestone 2: Recipient recovery and offline verification (weeks 4-6)

**Goal:** make emergency recovery possible without requiring the original account holder or a live support workflow.

Deliverables:

- Improve recipient-facing recovery instructions and share reconstruction UX.
- Publish an offline recovery procedure for recipients, including dependency pinning and integrity checks.
- Add signed recovery bundle format documentation: metadata, share identifiers, threshold, timestamps, and verification steps.
- Add tests for malformed shares, wrong threshold, duplicate shares, expired links, and tampered bundle metadata.

Acceptance evidence:

- Recipient can understand the recovery path from public docs.
- Offline instructions avoid sending secrets to third-party services.
- Recovery tests pass in CI/local validation.

## Milestone 3: Censorship-resistant disclosure path (weeks 7-10)

**Goal:** reduce dependence on KeyFate email and web availability at the moment a user is incapacitated.

Deliverables:

- Implement or complete Nostr disclosure publication using NIP-44 encryption and NIP-59 gift wrapping where feasible.
- Support multiple relay configuration with retry and publication status logging.
- Document recipient npub setup, relay assumptions, and metadata leakage limits.
- Add tests or integration harnesses for encrypted event creation, relay failure handling, and replay-safe publication.

Acceptance evidence:

- Triggered disclosure can be prepared for redundant relay delivery.
- Docs explain exactly what Nostr does and does not guarantee.
- Email remains available as a compatibility channel, not the only plan.

## Milestone 4: Abuse resistance and operational hardening (weeks 11-13)

**Goal:** make KeyFate safer against account takeover, denial of service, malicious operators, and deployment mistakes.

Deliverables:

- Harden rate limits, webhook replay defense, cron concurrency, audit logging, and alerting around disclosure-critical paths.
- Add admin/operator controls for pausing disclosure jobs during incidents without exposing plaintext secrets.
- Expand observability for disclosure attempts, failed check-ins, relay publication failures, and email bounces.
- Review data retention and deletion behavior for GDPR and high-risk users.

Acceptance evidence:

- Known critical operational risks have tracked mitigations or documented residual risk.
- Disclosure processing is idempotent and observable.
- Security-sensitive logs avoid plaintext secret leakage.

## Milestone 5: Public audit package and funder report (weeks 14-16)

**Goal:** leave the project reviewable by users, funders, and external security contributors.

Deliverables:

- Publish architecture, threat model, grant roadmap, and recovery docs from the README.
- Produce a funder-facing report with completed work, open risks, and next audit targets.
- Tag a release candidate or milestone branch containing tested freedom-tech deliverables.
- Prepare issues for independent security review and cryptographic implementation review.

Acceptance evidence:

- README links funders to roadmap and threat model.
- Open risks are explicit rather than hidden in marketing copy.
- The repository contains enough documentation for an external reviewer to assess the trust model.
