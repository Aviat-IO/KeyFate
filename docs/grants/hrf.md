# HRF project brief

## Project

**KeyFate:** a zero-knowledge dead man's switch for self-custody continuity and emergency disclosure.

## Why this fits HRF

The Human Rights Foundation funds tools that protect people under authoritarian pressure. KeyFate serves users who may be detained, disappeared, coerced, exiled, or cut off from their accounts. It helps them pre-authorize trusted recipients to recover critical information only after missed check-ins.

Relevant HRF-aligned use cases:

- Journalists preserving source-protection instructions and investigation handoff material.
- Activists and dissidents protecting Bitcoin recovery plans, legal contacts, safe-house instructions, or continuity documents.
- Humanitarian and civil-society workers ensuring teams can access emergency credentials if one person is arrested or incapacitated.
- Families in unstable jurisdictions preserving access to self-custodied savings without relying on banks or estate courts.

## Freedom-tech value

KeyFate is not a generic inheritance product. Its core value is resilience against censorship and coercion:

- User secrets are encrypted before server storage.
- Disclosure depends on explicit check-in failure and auditable state transitions.
- Planned Nostr delivery reduces dependence on email providers, web hosting, or a single company's continued existence.
- Recipient recovery docs can support offline reconstruction during shutdowns or internet disruptions.

## Requested funding theme

A focused HRF grant should fund:

1. Censorship-resistant disclosure through Nostr relay publication.
2. High-risk user threat-model hardening.
3. Offline recovery instructions and recipient safety UX.
4. Security review of disclosure trigger logic and metadata leakage.

## Deliverables

- Public threat model covering coercion, surveillance, account takeover, false triggers, and malicious infrastructure.
- Tested Nostr gift-wrap disclosure path or documented prototype with clear remaining gaps.
- Recipient recovery guide for at-risk users.
- Disclosure incident runbook and open audit checklist.

## Impact metric

A technically competent civil-society user can verify that KeyFate cannot read their protected material, can understand when disclosure occurs, and can give a recipient a recovery path that does not depend on a single censorable service.
