# KeyFate grant roadmap

KeyFate is a freedom-tech dead man's switch for high-risk people who need trusted others to recover critical information when they cannot check in. The first users are Bitcoin holders, journalists, activists, dissidents, humanitarian workers, and families protecting digital assets across borders.

Unlike generic estate SaaS, KeyFate is designed around adversarial failure modes:

- **Self-custody continuity:** encrypted recovery instructions, wallet seed material, and operational runbooks can reach chosen recipients without KeyFate learning the underlying secret.
- **Censorship-resistant disclosure:** the roadmap moves triggered disclosures from email-only delivery toward Nostr-backed relay publication and offline recovery tooling.
- **Minimized platform trust:** client-side encryption, Shamir-style secret sharing, auditable disclosure logic, and open-source implementation let users verify the security model instead of trusting a private vendor.
- **At-risk user safety:** threat modeling explicitly covers coercion, surveillance, account takeover, malicious insiders, false death triggers, and service shutdown.

## Documents

- [12-16 week milestone plan](./milestone-plan.md)
- [HRF project brief](./hrf.md)
- [OpenSats project brief](./opensats.md)
- [NLnet project brief](./nlnet.md)
- [Threat model](../threat-model.md)

## Funding priorities

1. Harden the cryptographic recovery path so KeyFate cannot decrypt user secrets.
2. Add redundant disclosure channels that survive email blocking, deplatforming, and KeyFate downtime.
3. Ship recipient recovery workflows that work during emergencies, including offline verification and reconstruction.
4. Publish security documentation, operational runbooks, and user safety guidance for high-risk deployments.
5. Build transparent testing and audit artifacts suitable for external review.

## Current technical baseline

The repository already includes a SvelteKit application with Auth.js authentication, PostgreSQL/Drizzle storage, encrypted secret workflows, recurring check-in and disclosure cron logic, email delivery, audit logging, Bitcoin payment support, and Nostr integration primitives. The grant roadmap funds hardening, usability, decentralization, and verification rather than a greenfield prototype.
