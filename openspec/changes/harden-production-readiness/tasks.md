## 0. Telos, specification, and baseline

- [x] 0.1 Record `TELOS.md` L4→L1 invariants for custody, delivery, durable work, billing, and release.
- [x] 0.2 Create proposal, design, tasks, and deltas for affected capabilities.
- [x] 0.3 Validate with `bunx @fission-ai/openspec@latest validate harden-production-readiness --strict`.
- [x] 0.4 Record baseline without additional scanning: `lint` fails on formatting; `check`, 549 tests, and `build` pass.

## 1. Atomic backend controls (TDD)

- [x] 1.1 Add failing concurrent PostgreSQL rate-limit tests for one atomic count/window decision and fail-closed storage errors.
- [x] 1.2 Implement atomic reset/increment upsert and update callers to deny on unavailable decisions.
- [x] 1.3 Add failing OTP tests for no-challenge guesses, challenge-scoped atomic attempts, consume-once success, expiry, and fresh-challenge reset.
- [x] 1.4 Remove durable victim-account lockout mutation from invalid OTP verification and use issued-token attempts only.
- [x] 1.5 Add failing checkout/webhook tests for POST-only behavior, plan allowlisting, canonical Stripe price, BTCPay top-level metadata, amount/currency validation, event ordering, and idempotency.
- [x] 1.6 Implement POST-only server-owned plan resolution and canonical Stripe/BTCPay entitlement.
- [x] 1.7 Add failing tests proving generic decryption and owner plaintext server-share/export endpoints are unavailable.
- [x] 1.8 Remove generic/plaintext server decryption paths and update callers/UX to use explicit recovery capabilities only.

## 2. Crash-safe disclosure and durable exports (TDD + generated migration)

- [x] 2.1 Add failing disclosure tests for two-worker claim, expired takeover, live exclusion, stale-worker fencing, per-recipient resume, and the documented before/after-provider-acceptance behavior.
- [x] 2.2 Add lease/generation fields and implement single-statement claims plus fenced disclosure finalization.
- [x] 2.3 Add failing export tests for atomic claim/takeover/fencing, cross-replica artifact survival, owner-only download, expiry, concurrent download cap, size cap, hash, and cleanup.
- [x] 2.4 Store bounded compressed export artifacts durably in PostgreSQL and implement owner-authorized download/status semantics without `/tmp`.
- [x] 2.5 Generate the additive migrations with Drizzle Kit and retain SQL, snapshots, and journal (`0009` and `0010`).
- [x] 2.6 Test fresh migration, existing-schema migration, mixed-version compatibility, stale-row reconciliation, and rollback/restore steps. The local PostgreSQL gate upgrades `0008` rows through `0010`, preserves duplicate legacy audit rows while converging new claims on one deterministic key, accepts old-replica additive writes, retries idempotently, and restores a logical backup into an isolated database.

## 3. Nostr custody and recovery v2 (TDD)

- [x] 3.1 Add strict schema/crypto tests for owner-signed v2 capsules and NIP-59 outer/seal/rumor/recipient/publisher/context verification.
- [x] 3.2 Add an instrumented default 2-of-3 creation test proving no server request contains S1/S2, K, passphrase, or another opening key.
- [x] 3.3 Move double encryption, capsule signing, gift wrapping, and publication into browser-safe modules; remove server signing key/plaintext-share contract.
- [x] 3.4 Update recovery UI to parse the canonical capsule, use `encryptedKNostr` and per-capsule nonce, verify expected bindings, and reject v1/mixed/conflicting artifacts.
- [x] 3.5 Store only public expected publisher/capsule/version bindings and add owner re-enrollment status for legacy records.
- [x] 3.6 Pass a real publisher→fake-relay→query→unwrap→K→share integration test.

## 4. Recipient-usable Bitcoin recovery (TDD)

- [x] 4.1 Add tests for recipient-controlled address validation, one-time branch key destruction, output address, complete signature, encrypted envelope, generation fencing, and local recovery validation.
- [x] 4.2 Replace owner-held recipient wallet keypair with recipient Bitcoin address and an in-memory one-time branch signing key.
- [ ] 4.3 Add an explicit encrypted owner continuity kit for refresh; sessionStorage is not the sole launch copy. **Partial:** the encrypted continuity-kit format and crypto tests exist, but no production owner download/import workflow calls them.
- [x] 4.4 Upload/store only recipient-encrypted complete transactions plus public metadata; reject private keys, K, and plaintext transaction fields.
- [ ] 4.5 Make refresh persist/publish the new generation before superseding old state and reject stale generations. **Partial:** the client operation and atomic generation-fenced endpoint exist, but no production owner workflow invokes them.
- [x] 4.6 Update recovery UI to require the current generation printed separately in the latest disclosure notice, then decrypt and validate the matching transaction before broadcast.
- [ ] 4.7 Remove the hard-disable only after a signet E2E proves funding, delayed transaction validity, recipient spendability, refresh, and recovery after browser restart. **Blocked:** `BITCOIN_ENROLLMENT_ENABLED` remains fail-closed pending credentialed signet evidence.

## 5. Browser/runtime hardening and probes

- [x] 5.1 Pin the fixed `sanitize-html` version, extract the blog formatter, and add allowlist regression tests.
- [ ] 5.2 Configure enforcing SvelteKit CSP and add header/browser smoke tests for sign-in/Turnstile, blog, creation/export, Nostr, and Bitcoin. **Partial:** enforcing CSP and policy regression tests pass; credentialed browser flows remain.
- [x] 5.3 Minimize Web Storage retention and ensure durable owner recovery material is encrypted explicit-download content.
- [x] 5.4 Add process-only `/api/health/live`, bounded dependency/config `/api/health/ready`, and `/api/health` compatibility tests.
- [x] 5.5 Add a runtime migration script, configure app-only `CMD`, and document/configure Railway pre-deploy migration.
- [x] 5.6 Split build/prod dependencies, preserve only required migration/runtime packages, pin exact Bun image digests/version, and pass non-root Docker/probe smoke.

## 6. CI, release, and operations

- [ ] 6.1 Fix current formatting/lint failures and make format/lint, check, tests, build, migration, Docker, and probe jobs required and ordered. **Partial:** formatting and the incremental lint gate pass and CI is ordered; the audited commit's legacy ESLint violations remain in a count-based baseline rather than being silently regenerated.
- [x] 6.2 Pin GitHub actions to full commit SHAs, set least-privilege permissions/concurrency, and prove frozen lockfile consistency.
- [ ] 6.3 Configure and evidence GitHub branch protection plus Railway Wait-for-CI or an explicit post-CI deploy with production environment approval.
- [ ] 6.4 Run credentialed staging E2E for OAuth, Turnstile, SendGrid, Stripe, BTCPay, all scheduled jobs, exports, Nostr, and Bitcoin under enforcing CSP.
- [ ] 6.5 Enable/verify Railway backups/PITR; restore into isolation; record RPO/RTO, owners, alerts, scheduler dashboards, rollback, and SLA evidence.
- [ ] 6.6 Confirm the exact green Git SHA is promoted to staging then production; retain deployment/provenance evidence.

## 7. Final validation

- [x] 7.1 Run focused tests after each tranche, then `bun run lint`, `bun run check`, `bun test`, and `bun run build`.
- [x] 7.2 Run Drizzle schema/migration checks and a PostgreSQL multi-worker failure-injection suite.
- [x] 7.3 Run Docker build/start/live/ready/non-root/migration smoke on Linux.
- [x] 7.4 Verify every task and release gate; document any external blocker without marking production ready.
