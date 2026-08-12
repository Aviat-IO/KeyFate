# HRF Use-Case Brief: Emergency Disclosure and Continuity

KeyFate is a dead-man's-switch service for time-delayed disclosure of encrypted
materials when a user stops checking in. For human-rights funders, the relevant
value is not a guarantee of safety. It is a way to reduce single-person failure
risk when sensitive access, evidence, or recovery instructions would otherwise
be lost, hidden, or controlled by one vulnerable person.

## Who this helps

### Journalist emergency document disclosure

An investigative journalist can pre-stage encrypted documents, source-contact
instructions, or publication notes for a trusted editor or legal partner. If the
journalist is detained, incapacitated, or disappears and misses required
check-ins, KeyFate can disclose the recovery material to those recipients.

This is best suited for continuity and accountability workflows. It should not
be represented as protection against surveillance, device compromise, coercion,
or physical harm.

### Activist detention contingency

A frontline activist can prepare instructions for legal counsel, coalition
leaders, or trusted family members: lawyer contact details, bail-fund access
steps, medical needs, device-account recovery paths, or public statement drafts.
If the activist cannot check in after a detention or border stop, those contacts
receive the planned materials.

This use should be paired with legal review and local safety planning. In some
jurisdictions, automated disclosure can increase risk if authorities learn that
detention may trigger publication or operational exposure.

### NGO operational continuity

A small NGO can use KeyFate for continuity when one coordinator holds critical
knowledge: emergency donor contacts, infrastructure recovery steps, custody of
organizational wallets, or instructions for preserving case files. The goal is
orderly handoff when a staff member is unavailable, not bypassing governance or
internal controls.

Organizations should avoid putting live credentials or unencrypted sensitive
records directly into any dead-man's-switch workflow. Use least-privilege access,
multisig, documented approval paths, and tested recovery drills.

### Family and self-custody inheritance recovery

A user can store recovery guidance for heirs: where seed backups are held, which
lawyer or executor to contact, how to identify wallets, and what not to do during
estate recovery. KeyFate can help families avoid permanent loss of self-custodied
assets after death or incapacity.

This is not a substitute for estate planning, tax advice, or secure custody
architecture. It should complement wills, trusts, legal executors, and wallet
setups that do not expose a single full key to one service or recipient.

## Ethical and safety caveats

- KeyFate cannot prevent arrest, coercion, malware, phishing, traffic analysis,
  compelled disclosure, or compromise of a user's device or email account.
- Automated disclosure can create retaliation risk. Users should threat-model
  whether disclosure after detention helps or harms them and their contacts.
- Recipients may face danger by receiving sensitive materials. They need consent,
  preparation, secure communication channels, and clear escalation instructions.
- Sensitive evidence should be minimized, encrypted, and shared only with people
  who have a legitimate need and capacity to handle it safely.
- Human-rights deployments should include local legal review, abuse reporting,
  emergency pause procedures, and plain-language user education.

## Security-risk references

- Current security risk review: [Security & Scalability Review](../SECURITY_SCALABILITY_REVIEW.md)
- Formal adversarial threat model: placeholder pending publication. Until then,
  funder materials should treat the security review above as the source for known
  risks and avoid claims that KeyFate is censorship-proof, detention-proof, or
  compromise-proof.
- Decentralized disclosure design background:
  [Nostr Integration Design Document](./NOSTR_INTEGRATION.md)

## Funder-readable impact framing

KeyFate can support human-rights resilience by making contingency instructions
available when a trusted person cannot act. The fundable outcome is improved
continuity and reduced loss of critical knowledge under stress. The responsible
claim is limited: KeyFate helps execute pre-planned disclosure workflows, but it
must be deployed with realistic threat modeling, recipient consent, and clear
limits on what the system can protect.
