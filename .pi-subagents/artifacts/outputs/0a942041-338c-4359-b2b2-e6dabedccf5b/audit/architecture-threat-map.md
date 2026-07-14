# Code Context

## Files Retrieved
1. `frontend/src/hooks.server.ts` (lines 1-89) - global Auth.js middleware, proxy/TLS handling, verification redirects, headers, scheduler startup.
2. `frontend/src/auth.ts` (lines 1-260) - Google and credential/OTP identity flows, DB user creation, JWT sessions.
3. `frontend/src/lib/server/auth.ts` (lines 1-53) - route-level session helpers.
4. `frontend/src/lib/db/schema.ts` (lines 1-260; file continues through line 809) - identity, token, secret, payment, audit, webhook, export/deletion persistence model.
5. `frontend/src/lib/db/drizzle.ts` (lines 1-104) - lazy PostgreSQL access and owner-scoped secret operations.
6. `frontend/src/routes/api/secrets/+server.ts` (lines 1-220) - principal secret-ingestion path: CSRF/session/verification/rate/tier validation, encryption, transactional writes.
7. `frontend/src/lib/encryption.ts` (lines 1-130) - environment-held AES-256-GCM key and server-side encrypt/decrypt sink.
8. `frontend/src/routes/api/encrypt/+server.ts` (lines 1-38) and `frontend/src/routes/api/decrypt/+server.ts` (lines 1-38) - generic authenticated crypto oracles.
9. `frontend/src/routes/api/webhooks/stripe/+server.ts` (lines 1-260) - signed Stripe input, deduplication, external lookup, subscription mutation, email alerts.
10. `frontend/src/routes/api/webhooks/btcpay/+server.ts` (lines 1-100; file continues) - signed BTCPay input and invoice-based subscription flow.
11. `frontend/src/routes/api/cron/check-secrets/+server.ts` (lines 1-30) and `frontend/src/lib/cron/utils.ts` (lines 1-145) - privileged disclosure trigger and bearer/HMAC authorization.
12. `frontend/Dockerfile` (lines 1-44) - Bun multi-stage, non-root Railway container, migrations and writable export directory.
13. `frontend/package.json` (lines 1-78) - SvelteKit node adapter, PostgreSQL/Drizzle, Auth.js, Stripe, SendGrid, Nostr, Bitcoin and crypto dependencies.
14. `docs/plans/migration-testing-checklist.md` (lines 1-91, 216-233) - Railway/PostgreSQL deployment and external integration verification status.

## Key Code
- `handle = sequence(authHandle, middlewareHandle)` makes Auth.js the first trust-boundary component; middleware trusts proxy headers for HTTPS and establishes request IDs/security headers (`hooks.server.ts:14-83`). There is no CSP header here.
- Identity: Google verified-email OAuth plus Credentials supporting OTP, password, and verification-token auto-login (`auth.ts:18-151`). Sessions are JWTs, 24-hour lifetime, hourly update (`auth.ts:153-158`); DB retains `sessionVersion`/invalidation timestamps and also a sessions table (`db/schema.ts:117-171`), so callback enforcement must be reviewed in the unread tail of `auth.ts`.
- Secret creation accepts JSON including title, recipients, Shamir parameters and `server_share`; it checks CSRF, session, email verification, rate/tier constraints, then AES-GCM encrypts and transactionally writes secret plus recipient identifiers (`routes/api/secrets/+server.ts:25-218`). A compatibility branch accepts caller-provided ciphertext/IV/tag (`:137-147`).
- Encryption key custody is a process environment secret (`ENCRYPTION_KEY[_V1]`) cached in-process; AES-256-GCM uses random 12-byte IVs (`lib/encryption.ts:38-113`). Generic `/api/decrypt` decrypts arbitrary authenticated-user ciphertext without object ownership or purpose binding (`routes/api/decrypt/+server.ts:12-31`).
- Cron authorization accepts either a static bearer secret or HMAC over timestamp and proxy-derived full URL, with five-minute freshness (`lib/cron/utils.ts:34-111`). POST check-secrets reaches the overdue-secret disclosure engine (`routes/api/cron/check-secrets/+server.ts:15-29`).
- Webhooks verify provider signatures before DB/subscription effects and claim deduplication records (`stripe/+server.ts:24-59`; `btcpay/+server.ts:18-63`). Stripe trusts signed metadata `user_id`, can call Stripe to resolve invoice subscription metadata, writes subscription state, and emits SendGrid/admin alerts (`stripe/+server.ts:65-124,184-260`).

## Architecture
Production is a single SvelteKit/adapter-node Bun container on Railway, started after migrations, running non-root and starting an in-process scheduler. Internet clients and OAuth/provider callbacks cross Railway TLS/proxy into SvelteKit routes. Auth.js issues JWT sessions; route handlers independently enforce session, verification, CSRF, admin, and ownership rules. PostgreSQL is the central durable trust domain for users, credentials/tokens, encrypted secret shares and recipients, subscriptions/payments/webhook claims, audits, exports, and deletion jobs. Environment variables hold database, Auth/OAuth, AES, cron, Stripe/BTCPay, and email credentials.

External flows: Google OAuth -> Auth.js -> users/audit DB; browser -> secret APIs -> AES key -> PostgreSQL; scheduler/cron -> overdue rows -> SendGrid and optionally Nostr relays/Bitcoin network; browser -> Stripe/BTCPay checkout; signed provider webhooks -> deduplication/subscription DB -> email alerts; GDPR export jobs -> `/tmp/keyfate-exports` -> authenticated download.

### Highest-risk DFD/CFD slices
1. **Credential custody / crypto oracle:** session theft -> unrestricted `/api/decrypt` -> attacker-selected ciphertext; server compromise/env leakage exposes the single AES key and all server shares. No ciphertext AAD/user/object binding is evident.
2. **Dead-man disclosure:** DB timestamps/status + cron authentication -> `runCheckSecrets` -> recipient email/Nostr publication. False trigger, replay, concurrent schedulers, recipient substitution, or logging plaintext has irreversible confidentiality impact.
3. **Secret creation/update/export/reveal:** attacker JSON/path IDs -> authorization/ownership -> encrypted-share and recipient DB -> response/download. Every `[id]`, `[recipientId]`, reveal/export/delete/send-now endpoint merits IDOR and reauthentication review.
4. **Payment entitlement:** signed but externally controlled webhook metadata -> user resolution -> subscription mutations. Deduplication/finalization ordering and metadata-to-user binding are critical.
5. **Nostr/Bitcoin continuity:** user-controlled npub/address/transaction data -> relay/broadcaster -> permanent public networks. Key custody, early discoverability, relay authenticity and fee/UTXO validation are high-impact.
6. **JWT invalidation/admin:** JWT claims -> DB session-version/admin state -> guards. Stale JWT privilege or revocation gaps are critical; verify callbacks query/compare current DB state.

### Attacker-controlled input inventory
- URL paths/query, JSON/form bodies, cookies/JWTs, Origin/Host and forwarded headers, request size/content-type.
- Registration email/password, OTP and reset/verification tokens; Google OAuth profile/callback state.
- Secret titles, plaintext/server shares, supplied ciphertext/IV/tag, Shamir thresholds, check-in dates, recipient email/name/npub, passphrases.
- Secret/recipient/job/deletion request IDs and all action toggles (send, reveal, export, publish, delete, check-in).
- Stripe/BTCPay raw bodies, signatures, IDs and signed metadata; provider API responses.
- Cron bearer/HMAC/timestamp plus proxy-derived host/protocol.
- Nostr relay events/pubkeys and Bitcoin transaction/UTXO/fee-provider responses.

### Sensitive sink inventory
- AES encrypt/decrypt and environment key loading; Shamir reconstruction; Nostr/Bitcoin signing/broadcast.
- PostgreSQL reads/writes/deletes for password hashes, OAuth tokens, verification/reset tokens, encrypted shares, recipients, entitlements, audits and webhook payloads.
- SendGrid/SMTP recipient delivery and admin-alert details; Nostr relay publication; Bitcoin broadcast; Stripe/BTCPay API calls.
- Logs (`console`/logger), especially exception stacks, webhook metadata and secret-processing failures.
- GDPR ZIP/temp-file creation and download; account deletion; migrations at startup.
- Redirects and response bodies returning decrypted/revealed/exported data.

### Unresolved questions
- Do JWT/session callbacks enforce `sessionVersion`, `sessionsInvalidatedAt`, current `isAdmin`, and email verification on every request?
- Are CSRF checks consistently applied to every cookie-authenticated mutation, especially generic encrypt/decrypt and action endpoints?
- Are reveal/export/server-share/send-now operations ownership-scoped and reauthenticated, and are downloads single-use/short-lived?
- Can multiple Railway replicas run the in-process scheduler concurrently; are disclosure jobs transactionally claimed/idempotent?
- Is Railway configured to overwrite untrusted forwarded headers, enforce request/body limits, and supply a hosted CSP?
- Where are AES/Nostr/Bitcoin keys backed up, rotated, and separated by environment; does DB compromise plus app env compromise defeat all threshold guarantees?
- Are webhook payloads/logs retention-limited and metadata user IDs cross-checked against provider customer/subscription ownership?
- Migration checklist still marks DNS/webhook/SendGrid and Nostr recovery checks incomplete (`docs/plans/migration-testing-checklist.md:59-78,216-233`); current production status needs external confirmation.

## Start Here
Open `frontend/src/routes/api/secrets/[id]/reveal-server-share/+server.ts` first, then `frontend/src/lib/cron/check-secrets.ts`: together they define the most consequential confidentiality boundary and automated disclosure path.

```acceptance-report
{
  "criteriaSatisfied": [
    {"id":"criterion-1","status":"satisfied","evidence":"Reconnaissance only; canonical source/deployment/docs inspected at b7b7aef1 and only the required audit artifact was written."},
    {"id":"criterion-2","status":"satisfied","evidence":"Architecture, boundaries, flows, high-risk slices, attacker inputs, sinks, questions, and file:line evidence are included above."}
  ],
  "changedFiles": [".pi-subagents/artifacts/outputs/0a942041-338c-4359-b2b2-e6dabedccf5b/audit/architecture-threat-map.md"],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {"command":"git status --short && git rev-parse HEAD && rg ...","result":"passed","summary":"Confirmed HEAD b7b7aef1a897c418e0402acd211fecf0206d8217 and inspected deployment/integration references; pre-existing untracked files were present."}
  ],
  "validationOutput": ["Required artifact written; no project/source files modified."],
  "residualRisks": ["This was targeted reconnaissance, not exhaustive endpoint-by-endpoint code review.","Working tree already contained untracked .pi-subagents/, docs plans, and progress.md; no claim is made that the repository is globally clean."],
  "noStagedFiles": true,
  "diffSummary": "Added only the requested security architecture/threat-map artifact.",
  "reviewFindings": ["high: frontend/src/routes/api/decrypt/+server.ts:12-31 - authenticated generic decryption oracle lacks object ownership/purpose binding","high: frontend/src/hooks.server.ts:70-83 - security headers omit Content-Security-Policy","no confirmed blocker from reconnaissance alone"],
  "manualNotes": "Review auth callback tail, reveal/export actions, and cron claim/idempotency next. Git status showed pre-existing untracked files."
}
```
