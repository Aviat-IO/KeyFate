## Context

KeyFate is a client-side Shamir dead-man switch deployed as a multi-replica SvelteKit/Bun service on Railway. The service's defining contract is that it cannot reconstruct an original secret while still delivering recovery after missed check-ins. The current implementation violates or cannot prove that contract in five areas: transient share custody, external recovery protocol binding, crash-safe durable jobs, canonical billing authorization, and tested release promotion.

This design is intentionally limited to issues already identified in the completed audit. It does not authorize additional scanning or feature expansion.

## Goals / Non-Goals

### Goals

- Preserve the `TELOS.md` invariant that the application never receives a Shamir threshold set.
- Make Nostr and Bitcoin recovery usable and authenticated for real recipients.
- Make disclosure and export workers recover from process death and replica overlap.
- Remove generic/plaintext recovery-factor APIs.
- Make abuse/billing decisions atomic, fail closed, and derived from canonical server/provider state.
- Produce an exact, tested, non-root runtime artifact with explicit probes and a one-per-deploy migration step.
- Define external Railway/provider gates honestly rather than claiming repository-only completion.

### Non-Goals

- Exactly-once email transport; provider acceptance followed by a crash can still cause duplicate delivery. The invariant is at-least-once delivery with idempotent/fenced application state.
- Server custody of owner/recipient private keys, plaintext recipient shares, K, or plaintext Bitcoin recovery transactions.
- Automatic upgrade of legacy Nostr/Bitcoin records without the owner recreating missing authenticated material.
- New recovery transports or infrastructure providers.

## Decisions

### 1. Recovery custody boundary

For authenticated v3 recovery, the browser generates a random 32-byte content-encryption key, AEAD-encrypts the structured secret, and Shamir-splits only that uniformly random key. Only service share S0 crosses to KeyFate. One shared logical recipient share S1 is encrypted separately for every recipient; remaining offline shares stay owner-controlled. No server request may contain S1/S2 plaintext, the reconstructed content key, or a key capable of opening S1.

Automated service/Nostr v3 recovery is restricted to threshold 2. Higher-threshold schemes require a separately approved custodian-role model and are not silently mapped onto the shared-recipient-share custody model.

The generic `/api/decrypt` route is removed. Owner export no longer requests/decrypts the server share. Disclosure-time access to S0 uses a one-time capability whose stored verifier is hashed; the capability route is purpose-bound to one secret and expires/consumes atomically.

Alternatives rejected:

- server-side Nostr double encryption: violates the custody boundary transiently;
- relying on TLS or prompt deletion: the application process still observes plaintext;
- retaining generic decrypt for convenience: cross-tenant/purpose binding cannot be guaranteed.

### 2. Authenticated v3 recovery and independently pinned Nostr identity

The owner browser creates a random set ID and content key, AEAD-encrypts a strict versioned secret payload with domain-separated associated data, and Shamir-splits the content key. It emits strict share envelopes containing the scheme/version, set ID, threshold, total, actual embedded Shamir index, share bytes, protected-secret ciphertext and nonce, and ciphertext digest. The ciphertext digest is safe to distribute because encryption uses a fresh random key and nonce; no plaintext secret hash is published because that would create an offline dictionary oracle for low-entropy secrets.

Before interpolation, recovery requires matching scheme/version/set ID/threshold/total/ciphertext metadata, distinct valid indices, wrapper-to-embedded-index agreement, and at least the declared threshold. It reconstructs exactly one 32-byte content key and releases plaintext only after AEAD authentication succeeds. A failed v3 check never falls back to legacy parsing.

The owner browser creates and signs a strict v3 Nostr capsule and manifest that additionally bind the set ID, ciphertext digest, threshold, total, actual shared recipient index, recipient identity, and event IDs. It exports the exact signed manifest and trust metadata in a per-recipient setup bundle. The owner must deliver that bundle through an owner-controlled out-of-band channel before disclosure. V3 recovery imports the retained bundle as its trust anchor and never treats a self-signed manifest supplied by KeyFate at disclosure as the expected owner identity.

The browser publishes the signed capsule and NIP-59 gift wrap directly. An optional app relay endpoint may accept only an already-signed opaque event after ownership and schema checks; it never signs or receives a plaintext recipient share. Recovery verifies the retained bundle, outer event, seal, rumor, capsule, publisher, recipient, secret, set, share, and ciphertext bindings before decrypting a share.

Enrollment is two phase. Registration stores opaque signed artifacts while the secret remains paused. Only an authenticated, CSRF-protected finalization after the owner confirms setup-bundle download/distribution may mark v3 recovery ready, activate the secret, or schedule reminders.

V1/v2 Nostr and raw Shamir material are never interpreted as v3. Existing material cannot be upgraded without the original secret and keys. A deliberately selected legacy recovery mode may interpolate it only with an explicit unverified result state; re-enrollment remains the secure path.

### 3. Recipient-usable Bitcoin delivery

Keep the CSV script's owner and delayed branches, but treat the delayed-branch key as a one-time signing key generated in the owner browser. It signs the complete delayed transaction after the funding outpoint is known and is then destroyed.

The delayed transaction pays a network-valid Bitcoin address supplied for and confirmed by the actual recipient; it does not pay an address derived from an owner-held recipient key. The complete transaction is encrypted to the recipient Nostr pubkey before upload. The server stores ciphertext plus public lifecycle metadata only.

Owner refresh continuity uses an owner-controlled encrypted continuity kit, not sessionStorage as the sole copy. Each setup/refresh first creates the new generation, complete recipient-encrypted envelope, and encrypted owner kit; the owner must make the kit durable before broadcast. The server then persists a non-ready prepared transition, broadcast uses the locally computed transaction ID, and an idempotent exact-output finalizer advances readiness/check-in and supersedes the old database generation. Accepted-then-timeout or process failure remains an explicit prepared/ambiguous state that can be retried from durable encrypted kit plus public prepared metadata without the destroyed one-time branch key.

The recipient browser decrypts the current transaction and validates network, input outpoint, sequence, witness script, OP_RETURN capsule binding, and payment output/address before broadcast.

Alternatives rejected:

- generating a recipient wallet in the owner's browser: the actual recipient cannot spend the output;
- uploading plaintext pre-signed transactions: OP_RETURN contains K;
- simply removing the current placeholder guard: activates an unrecoverable flow.

### 4. Fenced durable work

Disclosure and export claims are one PostgreSQL statement that sets a random lease ID and expiry. Every completion, failure, retry, and cleanup update is fenced by the current lease ID. Expired leases are reclaimable; stale workers affect zero rows. No transaction remains open during provider or serialization work.

Disclosure completion is derived from committed per-recipient outcomes. `processing` is never terminal. Provider delivery is at least once because a process may die after provider acceptance but before commit.

Exports use the same claim model. JSON artifact bytes are stored as bounded compressed `bytea` with hash, size, content type, expiry, and download count. PostgreSQL is selected for the initial bounded export size so all Railway replicas share it without adding another provider. A later object-store change requires a separate proposal.

### 5. Atomic authorization and billing

Rate limits use a single PostgreSQL upsert with reset-or-increment SQL and return the committed count/expiry. Database uncertainty denies the protected action.

OTP failures mutate only an active unexpired challenge. Guesses for an email without a challenge cannot create account lockout state. Challenge attempt increment/consume is atomic; endpoint/IP limits remain separate.

Checkout creation is POST-only. Clients send a plan enum, never a Stripe lookup key, amount, or currency. Server configuration resolves the exact provider price and accounting currency. Webhooks retrieve canonical provider objects and verify product, price, amount, currency, interval, livemode/store, and user metadata before entitlement. Event timestamps/order are monotonic or reconciled from provider state.

BTCPay handling maps official top-level webhook metadata and fetches the full invoice before entitlement. Invoice amount/currency are compared to the server plan.

### 6. Browser execution policy and content

Use SvelteKit `kit.csp` with nonces/auto handling. Enforce `default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and `form-action 'self'`, then add only observed Turnstile, relay, and Bitcoin connections. `style-src 'unsafe-inline'` is accepted initially for Svelte/Tailwind compatibility and tracked for later reduction.

Upgrade `sanitize-html` to the exact fixed version and extract/test the blog formatter with the existing narrow allowlist. Sensitive recovery data is not retained longer than the active creation/recovery flow; durable owner kits are explicit encrypted downloads. KeyFate does not generate, consume, or support share-bearing URLs or `mailto:` bodies. Recovery responses use `no-store` and `no-referrer`; the UI instructs users to paste or import material locally and warns that user-crafted URLs can reach upstream infrastructure.

### 7. Runtime, migrations, and release

Migrations use a runtime script based on `drizzle-orm/postgres-js/migrator` and execute as Railway's pre-deploy command. App `CMD` starts only the built server. Schema changes are expand/contract and generated only with `bunx drizzle-kit generate`; SQL, snapshot, and journal are committed together.

The runtime image installs production dependencies only and copies the built output, generated migrations, and minimal migration runtime. Bun images, Bun CI version, and actions are pinned to exact versions/SHAs. CI runs format/lint, Svelte check, tests, build, migration smoke, Docker build, and runtime/probe smoke in dependency order.

`/api/health/live` checks process liveness only. `/api/health/ready` performs bounded database and required local configuration validation without depending on external provider network calls. `/api/health` remains a compatibility alias to readiness.

Production promotion remains blocked until GitHub required checks/environment approval and Railway Wait-for-CI or explicit post-CI deployment are configured and exercised for the exact SHA.

## Risks / Trade-offs

- PostgreSQL export bytes increase database storage/load. Mitigation: strict artifact cap, compression, expiry cleanup, metrics, and disable-new-export switch.
- Mixed old/new workers are not mutually fenced. Mitigation: additive migration, pause cron during final rolling replacement, and never roll back to an unfenced multi-replica build.
- Legacy recovery records cannot be upgraded automatically. Mitigation: explicit fail-closed status, isolated unverified legacy interpolation, and owner re-enrollment UX.
- Recipient loss of the owner-delivered setup bundle makes authenticated v3 Nostr recovery impossible. Mitigation: require download/distribution confirmation, provide redundant owner-controlled copies, and fail closed rather than trust a disclosure-time replacement.
- Shared recipient custody supports automated service/Nostr recovery only at threshold 2. Mitigation: reject higher-threshold v3 enrollment until a separately approved custodian-role model exists.
- JavaScript cannot guarantee secret zeroization and origin compromise can observe creation/recovery plaintext. Mitigation: minimize copies and retention, enforce CSP, support offline recovery, and state the browser-origin trust assumption accurately.
- Direct browser Nostr publication depends on CSP/network/relay availability. Mitigation: fixed relay configuration, health feedback, signed-event retry, and optional opaque relay endpoint.
- At-least-once email can duplicate. Mitigation: deterministic disclosure IDs and provider idempotency where available; never mark unsent work complete.
- Action/image digest maintenance adds operational work. Mitigation: deliberate dependency-update changes with CI smoke evidence.

## Migration Plan

1. Merge spec and failing tests.
2. Add nullable lease/artifact/recovery-version columns and generated indexes; deploy migration independently.
3. Deploy code that reads v1/v2 only through explicit legacy paths and writes authenticated v3 only. Mark legacy Nostr/Bitcoin records for re-enrollment.
4. Pause scheduler during the old/new worker overlap, replace all replicas, reconcile only stale non-terminal rows, then resume.
5. Enable Nostr v3 only after authenticated-envelope, setup-bundle, two-phase enrollment, browser round-trip, tamper, downgrade, and legacy-isolation tests; enable Bitcoin only after signet funding/refresh/recovery tests.
6. Configure Railway pre-deploy migration, probes, required CI gate, backups, alerts, and staging provider credentials.
7. Remove legacy write paths and columns only in a later generated contract migration after measured re-enrollment/retention.

Rollback uses a compatibility build that understands additive columns. It never reintroduces generic decryption, server-side recipient-share publication, session-only recipient custody, or unfenced workers. Destructive migration rollback is backup restore plus documented data-integrity verification.

## Open Questions

- None block repository implementation. Railway plan capabilities, backup retention, external approval policy, and production provider catalog values remain credentialed acceptance gates rather than code assumptions.
