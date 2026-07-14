# TELOS — KeyFate

> KeyFate exists to make time-triggered recovery dependable without making KeyFate a custodian of the user's original secret.

**Status:** Draft inferred from `openspec/project.md`, current specs, and the explicit production-readiness request. Owner confirmation is still required before changing L4 purpose; the hardening work below does not change it.

## L4: Purpose

KeyFate serves people who need a secret disclosed to chosen recipients after missed check-ins, including journalists, estate-planning users, and cryptocurrency holders.

Success means:

- recipients can recover the intended secret after the configured condition;
- normal service operation and service compromise cannot reconstruct the original secret;
- disclosure survives process crashes, rolling deployments, and replica overlap;
- Nostr and Bitcoin recovery both work at launch;
- production releases are validated, attributable to an exact source revision, and recoverable.

Hard constraints:

- secret creation and recovery remain client-side;
- the service never receives or stores a Shamir threshold set;
- no recipient or wallet private key is transmitted to the service;
- PostgreSQL is the durable coordination boundary for Railway replicas;
- Bun, SvelteKit 5, Drizzle-generated migrations, and Railway remain the platform contract.

## L3: Experience

Owners should be able to create, test, refresh, and inspect recovery without learning protocol internals. Recipients should receive one authenticated recovery manifest and complete recovery locally with the credentials or wallet they control.

The experience principles are:

1. fail visibly rather than claim a recovery path is ready when it is not;
2. preserve confidentiality without sacrificing delivery reliability;
3. require re-enrollment when legacy material cannot be upgraded safely;
4. make operational health and release state observable to maintainers;
5. keep payment and export behavior predictable and idempotent.

## L2: Contract

- **Secret custody:** the server may receive/release one service share only. Recipient/offline shares and keys remain client-side.
- **Nostr delivery:** clients create and sign versioned recovery capsules; recovery verifies every event layer and binds it to the expected publisher, recipient, secret, and share metadata.
- **Bitcoin delivery:** the owner browser may use a one-time branch signing key, but the final output pays an address controlled by the real recipient. The recipient receives an encrypted complete transaction and never depends on an owner browser session.
- **Disclosure jobs:** durable lease ownership and fenced writes prevent stale replicas from finalizing work; expired work is recoverable.
- **Exports:** durable shared artifacts, atomic claims/download limits, owner authorization, and bounded retention replace replica-local files.
- **Authentication and abuse controls:** failures are challenge-scoped; rate-limit decisions are atomic and fail closed.
- **Billing:** only server-owned plans/prices/currencies can create entitlement; signed webhooks are necessary but not sufficient.
- **Production delivery:** liveness/readiness are explicit, migrations are a one-per-deploy operation, CI gates immutable release artifacts, and external Railway gates are evidenced before launch.

## L1: Function

Implementation is organized around:

- browser recovery modules under `frontend/src/lib/crypto`, `frontend/src/lib/nostr`, and `frontend/src/lib/bitcoin`;
- SvelteKit owner/recipient routes and components;
- PostgreSQL-backed leases and artifacts in Drizzle schema/queries;
- focused route, concurrency, protocol, and end-to-end tests written before each behavioral change;
- OpenSpec deltas in `openspec/changes/harden-production-readiness/`;
- validation with `bun run lint`, `bun run check`, `bun test`, `bun run build`, generated migration checks, Docker smoke, and credentialed staging gates.
