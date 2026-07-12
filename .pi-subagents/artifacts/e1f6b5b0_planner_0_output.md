# Implementation Plan

## Goal
Make the six already-flagged backend paths crash-recoverable, multi-replica safe, fail-closed, side-effect disciplined, and incapable of returning server-decrypted shares, without performing any broader security review.

## Tasks

1. **Record the bounded production-hardening change and its invariants before implementation**
   - Files: `openspec/changes/harden-production-backend/proposal.md`, `openspec/changes/harden-production-backend/design.md`, `openspec/changes/harden-production-backend/tasks.md`, and capability deltas under `openspec/changes/harden-production-backend/specs/`
   - Changes: Limit the proposal to disclosure recovery, durable exports, database rate limiting, OTP failure isolation, checkout/webhook correctness, and removal of server-decryption APIs. Specify PostgreSQL as the shared coordination/durable artifact store so Railway replicas do not depend on local `/tmp`. Specify at-least-once disclosure delivery: a crash after provider acceptance but before the `sent` commit can duplicate an email, but must never cause an unsent recipient to be counted as sent. Include artifact size/retention limits and rollout/rollback rules below.
   - Acceptance: `openspec validate harden-production-backend --strict` passes and the proposal is explicitly approved before schema or runtime changes begin.

2. **Write failing disclosure lease/recovery tests**
   - Files: add `frontend/src/lib/cron/__tests__/process-reminders.test.ts`; extend `frontend/src/lib/db/queries/__tests__/secrets-disclosure.test.ts`; update affected route tests such as `frontend/src/routes/api/secrets/[id]/send-now/__tests__/send-now.test.ts`.
   - Changes: Cover two workers racing for one secret, reclaim of an expired lease after crash/rolling deploy, refusal to reclaim a live lease, fencing of a stale worker after takeover, retry of a `pending` recipient log rather than counting it as sent, skipping only `sent` logs, partial-recipient recovery, and final transition only when every current recipient has a committed `sent` log. Verify check-in/send-now semantics distinguish `status='triggered' AND triggered_at IS NULL` (processing) from terminal disclosure.
   - Acceptance: Tests fail against the current `active -> triggered` pseudo-lock and its conflict-as-sent behavior.

3. **Implement fenced disclosure leases and recipient recovery**
   - Files: `frontend/src/lib/db/schema.ts`, `frontend/src/lib/cron/process-reminders.ts`, `frontend/src/lib/cron/disclosure-helpers.ts`, `frontend/src/lib/db/queries/secrets.ts`, `frontend/src/routes/api/check-in/+server.ts`, `frontend/src/routes/api/secrets/[id]/send-now/+server.ts`, and any UI mapper that treats every `triggered` row as terminal (notably `frontend/src/lib/db/secret-mapper.ts`).
   - Changes: Add `secrets.processingLeaseId` and `secrets.processingLeaseExpiresAt`; add equivalent lease/fencing fields and an attempt counter to `disclosure_log`. Claim with one conditional `UPDATE ... WHERE (status='active' OR (status='triggered' AND triggered_at IS NULL AND lease_expires_at <= now())) RETURNING`, assigning a fresh unguessable lease ID and expiry. Every state mutation by a worker must include `WHERE processing_lease_id = <its lease>`; a takeover changes the lease ID and fences the old worker. Claim each recipient independently; reclaim expired `pending`/processing attempts, and treat only a committed `sent` row as delivered. On partial failure/timeout, clear the secret lease and return to retryable `active`; on completion, atomically set terminal `triggered_at`, clear lease fields, and derive completion from database logs rather than process-local counters. Do not hold a database transaction open across email I/O.
   - Acceptance: The tests from task 2 pass under concurrent database-backed execution. A killed worker followed by another replica completes all recipients; a stale worker cannot finalize or revert the takeover.

4. **Write failing export claim, durability, authorization, and download tests**
   - Files: add `frontend/src/lib/cron/__tests__/process-exports.test.ts`, `frontend/src/lib/gdpr/__tests__/export-service.test.ts`, and `frontend/src/routes/api/user/export-data/[jobId]/__tests__/server.test.ts`.
   - Changes: Cover atomic single-worker claim, expired-lease reclaim, live-lease exclusion, stale-worker fencing, artifact survival across simulated replica/process replacement, owner-only status/download, expired and non-completed denial, atomic three-download cap under concurrent requests, no count increment for status polling, successful streamed JSON download with attachment/no-store headers, and cleanup of artifact bytes. Include a configured maximum artifact size and prove oversize jobs fail without leaving bytes marked downloadable.
   - Acceptance: Tests fail against select-then-update processing, `/tmp`, missing generated download route, and read/then-increment download counting.

5. **Implement durable export artifacts and an atomic download route**
   - Files: `frontend/src/lib/db/schema.ts`, `frontend/src/lib/gdpr/export-service.ts`, `frontend/src/lib/cron/process-exports.ts`, `frontend/src/lib/cron/cleanup-exports.ts`, `frontend/src/routes/api/user/export-data/[jobId]/+server.ts`, `frontend/src/routes/api/user/export-data/+server.ts`, `frontend/src/routes/(authenticated)/settings/privacy/+page.server.ts`, and `frontend/src/lib/components/DataExportCard.svelte` if it consumes `fileUrl` directly.
   - Changes: Add export `processingLeaseId`, `processingLeaseExpiresAt`, `attemptCount`, and a durable PostgreSQL artifact column (`bytea`, preferably compressed JSON) plus content type/name fields. Claim jobs via a single `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10) RETURNING`; include pending and expired processing leases. Fence completion/failure updates by lease ID. Replace generated `/api/user/export-data/download?user=...&file=...` URLs with the authenticated job route. Split status polling from download: `GET` returns metadata only and has no side effects; add a CSRF-protected `POST` download action (or a dedicated `[jobId]/download/+server.ts` POST) that atomically increments only when `status='completed'`, `expires_at > now()`, `download_count < 3`, and `user_id` matches, then streams the stored bytes with `Content-Disposition: attachment`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. Cleanup must null/delete artifact bytes with the expired job. Use the existing authenticated user ID, never user/file query parameters.
   - Acceptance: Task 4 passes across two worker instances. No completed job references local filesystem state, and four concurrent download attempts yield exactly three successful claims.

6. **Write failing PostgreSQL rate-limiter concurrency and outage tests**
   - Files: add `frontend/src/lib/__tests__/rate-limit-db.test.ts`; extend endpoint tests at `frontend/src/routes/api/auth/register/__tests__/server.test.ts` and `frontend/src/routes/api/check-in/__tests__/server.test.ts`.
   - Changes: Run more concurrent checks than the configured limit and assert exactly `limit` successes, monotonic nonnegative remaining values, one window reset, and no unique-key race. Inject database errors and assert protected requests are denied with a stable 429/503 policy and retry metadata rather than allowed.
   - Acceptance: Tests expose the current read-modify-write lost update and fail-open catch.

7. **Replace the rate limiter with one atomic PostgreSQL statement and fail closed**
   - Files: `frontend/src/lib/rate-limit-db.ts`, `frontend/src/lib/rate-limit.ts`, and callers/tests from task 6.
   - Changes: Use `INSERT ... ON CONFLICT (key) DO UPDATE` with SQL expressions that reset expired windows or increment a live count atomically, returning the committed count/expiry from the same statement. Convert storage errors into an explicit unavailable/denied result; callers must not continue the protected operation. Log only the limiter type and operational error, not raw identifiers. Keep cleanup best-effort because it does not authorize requests.
   - Acceptance: Task 6 passes repeatedly against PostgreSQL; no request is admitted because the limiter errored.

8. **Write failing OTP anti-lockout and concurrency tests**
   - Files: add `frontend/src/lib/auth/__tests__/otp.test.ts`; add/extend `frontend/src/routes/api/auth/request-otp/__tests__/server.test.ts` and `frontend/src/routes/api/auth/verify-otp/__tests__/server.test.ts` (and Auth.js credential-flow tests if verification occurs through `frontend/src/auth.ts`).
   - Changes: Prove guesses for an email without an active issued authentication OTP never create/update `account_lockouts`; wrong OTPs cannot permanently lock an account; an active token's attempt count is atomic under concurrency; successful validation consumes exactly once; requesting a fresh OTP restores a bounded challenge after the previous challenge is exhausted; and limiter/database failure blocks request and verification. Ensure IP is passed to `createOTPToken` from request handling and enforced before email-scoped work.
   - Acceptance: Tests fail because current arbitrary invalid codes call `trackFailedAttempt(email)` and eventually set permanent account lockout.

9. **Confine OTP failures to the issued challenge, not the account**
   - Files: `frontend/src/lib/auth/otp.ts`, `frontend/src/routes/api/auth/request-otp/+server.ts`, `frontend/src/routes/api/auth/verify-otp/+server.ts`, and `frontend/src/auth.ts` as needed.
   - Changes: Remove OTP's reads/writes of `accountLockouts` and delete `trackFailedAttempt`. Lock the latest active authentication token row for the normalized email, atomically increment that token's `attemptCount` on mismatch, expire only that challenge at the cap, and consume a matching unexpired token once. Apply the atomic fail-closed IP limiter to verification as well as issuance. Return generic errors so token existence is not disclosed. Retain `account_lockouts` only if another authentication method demonstrably uses it; otherwise schedule its later removal rather than coupling that cleanup to this fix.
   - Acceptance: Task 8 passes; unauthenticated traffic can exhaust only a short-lived OTP challenge and IP budget, never persistently lock the account.

10. **Write failing checkout and payment/webhook contract tests**
    - Files: add `frontend/src/routes/api/create-checkout-session/__tests__/server.test.ts` and `frontend/src/routes/api/create-btcpay-checkout/__tests__/server.test.ts`; extend `frontend/src/routes/api/webhooks/btcpay/__tests__/server.test.ts` and `frontend/src/lib/services/__tests__/subscription-lifecycle.test.ts` or add `frontend/src/lib/services/__tests__/webhook-handlers.test.ts`.
    - Changes: Assert GET never creates a customer/session/invoice and returns 405 or a non-mutating redirect; POST requires CSRF/auth; Stripe rejects every lookup key outside `STRIPE_LOOKUP_KEYS` before provider calls; BTCPay accepts a server-owned plan/interval only, ignores/rejects client amount/currency, and creates an invoice from server pricing. For settled webhooks, prove fetched invoice metadata is passed to the handler, `user_id`, interval, original amount, and original currency are validated, malformed metadata cannot activate a subscription, and payment history records the intended accounting amount/currency consistently rather than a BTC value in a two-decimal fiat column.
    - Acceptance: Tests fail against GET side effects, arbitrary Stripe lookup keys, client-controlled BTCPay parameters, and the current loss of fetched invoice metadata between route and handler.

11. **Make checkout POST-only, allowlisted, and canonicalize BTCPay invoices**
    - Files: `frontend/src/routes/api/create-checkout-session/+server.ts`, `frontend/src/routes/api/create-btcpay-checkout/+server.ts`, `frontend/src/lib/constants/tiers.ts`, `frontend/src/lib/pricing.ts`, `frontend/src/routes/api/webhooks/btcpay/+server.ts`, `frontend/src/lib/services/webhook-handlers.ts`, `frontend/src/lib/payment/providers/BTCPayProvider.ts`, and checkout button/auth-return UI callers (`frontend/src/lib/components/StripeCheckoutButton.svelte`, `frontend/src/lib/components/BTCPayCheckoutButton.svelte`).
    - Changes: Remove mutating GET implementations; after authentication, render/submit a CSRF-protected POST rather than encode purchase parameters into a GET. Validate Stripe input against the exact constant value set before listing prices/customer creation. Replace BTCPay amount/currency/mode input with an allowlisted plan/interval and derive invoice amount/currency from `getAmount` (invoice in the accounting currency, allowing BTCPay to quote BTC). Fetch the full invoice once in the webhook route, validate typed metadata and invoice state/currency, construct the canonical event object consumed by `handleBTCPayWebhook`, and record original accounting amount/currency. Fail the webhook before subscription mutation on missing/inconsistent metadata; retain deduplication semantics.
    - Acceptance: Task 10 passes and provider mocks show zero mutations for GET or rejected input.

12. **Write failing tests for removal of server plaintext paths**
    - Files: add `frontend/src/routes/api/decrypt/__tests__/server.test.ts`; add tests for `frontend/src/routes/api/secrets/[id]/server-share/+server.ts` and `frontend/src/routes/api/secrets/[id]/export-share/+server.ts`; extend `frontend/src/routes/api/secrets/[id]/send-now/__tests__/send-now.test.ts` and disclosure tests.
    - Changes: Assert `/api/decrypt` is absent/410 and never invokes `decryptMessage`; owner-facing server-share/export-share routes never return decrypted material; ciphertext retrieval, if product-required, returns only stored ciphertext/IV/auth tag/key version; disclosure/send-now decrypt only inside the narrowly scoped delivery operation and never include plaintext in responses, logs, DB, or audit details.
    - Acceptance: Tests fail against the generic authenticated decryption oracle and plaintext-returning server-share routes.

13. **Delete generic decryption and remove user-facing server-share plaintext responses**
    - Files: remove `frontend/src/routes/api/decrypt/+server.ts`; modify or remove `frontend/src/routes/api/secrets/[id]/server-share/+server.ts` and `frontend/src/routes/api/secrets/[id]/export-share/+server.ts`; update their UI callers, including `frontend/src/lib/components/ExportRecoveryKitButton.svelte` if applicable. Keep `frontend/src/lib/encryption.ts` private to the bounded server delivery workflow and cryptographic unit tests.
    - Changes: Eliminate arbitrary server decryption. Remove routes that decrypt a database `serverShare` and return plaintext/token material. If recovery export remains required, return the encrypted share envelope for client-side/offline handling, clearly versioned. Keep server decryption only in disclosure/send-now, with ownership/state checks, lease fencing for scheduled delivery, buffer zeroing, and no plaintext persistence. Update claims/docs that contradict this bounded server-held-key design; do not redesign cryptography beyond the flagged paths.
    - Acceptance: Task 12 passes; a repository reference check shows production `decryptMessage` calls only in approved delivery code (plus unit tests), with no HTTP response containing decrypted share data.

14. **Generate and verify migrations—never hand-author them**
    - Files: `frontend/src/lib/db/schema.ts`; generated `frontend/drizzle/NNNN_harden_production_backend.sql`, `frontend/drizzle/meta/NNNN_harden_production_backend_snapshot.json`, and `frontend/drizzle/meta/_journal.json` (exact sequence assigned by Drizzle).
    - Changes: After all schema edits, run `cd frontend && bunx drizzle-kit generate --name="harden_production_backend"`; do not edit generated SQL/snapshot/journal. Review for nullable additive lease/artifact columns and indexes supporting stale-lease claims (`status`, lease expiry) without table rewrites. Deploy migration before code that writes the new fields. Backfill is unnecessary because nullable lease fields mean existing pending/active rows are immediately claimable; existing `processing` exports and `triggered` secrets with `triggered_at IS NULL` require a one-time, explicitly reviewed recovery operation after deployment, not an unbounded migration update.
   - Acceptance: A fresh database migrates, an existing-schema fixture migrates, schema snapshots match, and mixed old/new application versions do not fail reads.

15. **Run focused, full, and operational validation in rollout order**
    - Files: all above; deployment runbook/change design.
    - Changes: Run focused tests first, then `bun test`, `bun run check`, and `bun run build`. In staging, run two app replicas and kill one after claims: verify disclosure takeover, export takeover, no local-file dependency, limiter concurrency, and webhook deduplication. Add metrics/logs for claimed/reclaimed/fenced jobs, stale leases, export artifact size, limiter unavailable denials, OTP challenge exhaustion, rejected checkout input, and webhook metadata failures—without plaintext or email identifiers.
    - Acceptance: All commands pass; staging kill/redeploy drills produce database evidence of recovery and fencing before production rollout.

## Transaction and Lease Invariants

- A job/secret is owned only when the worker holds the current random lease ID and the lease is unexpired at claim time.
- Claim/takeover is one PostgreSQL statement; no select-then-update ownership decisions.
- Every completion, failure, retry, and cleanup write is fenced by current lease ID. A stale worker's write must affect zero rows and be treated as lost ownership.
- No transaction remains open during email, export serialization, or payment-provider network I/O.
- Disclosure completion is derived from committed per-recipient `sent` rows. `pending`/processing is never equivalent to sent.
- Export completion is visible only after durable bytes and metadata are committed together under the current lease.
- Download authorization, expiry, and quota consumption are one conditional transaction/statement; status polling is read-only.
- Rate-limit authorization is based on the count returned by one atomic upsert; database uncertainty denies authorization.
- OTP attempt state belongs to one expiring issued challenge, not a durable account lockout.

## Migration, Rollout, and Rollback

1. Merge approved OpenSpec and failing tests.
2. Add nullable columns/indexes and generate all three Drizzle artifacts with `drizzle-kit generate` only.
3. Deploy migration independently/additively; verify indexes and column presence.
4. Deploy code capable of claiming legacy null-lease rows. Do not run old and new workers concurrently longer than the rolling deployment window; old workers are not lease-fenced.
5. Pause cron processing during the final mixed-version interval if Railway cannot guarantee rapid replacement, then resume only after all replicas run the fenced implementation.
6. Reconcile legacy stranded rows explicitly: only `triggered_at IS NULL` disclosure rows and `processing` exports older than the chosen lease timeout are eligible. Produce counts before/after; never reset terminal `triggered_at IS NOT NULL` rows.
7. Rollback application code only to a compatibility build that understands the additive columns. Do not roll back to unfenced workers while multiple replicas run. Leave nullable columns/artifact data in place; destructive column removal is a later migration after retention expiry.
8. If export artifacts threaten database capacity, disable new export requests and processing, retain existing artifacts for download/cleanup, and decide on an external shared object store in a separate approved change. Do not fall back to `/tmp` or a per-replica Railway volume.

## Fixes That Can Avoid Schema Changes

- Atomic/fail-closed `rate_limits` upsert uses the existing primary key and columns.
- OTP account-lockout removal and per-token attempt tracking can use existing `verification_tokens.attempt_count`; `account_lockouts` need not be dropped in this change.
- Checkout GET removal, Stripe allowlisting, BTCPay plan derivation, and webhook canonicalization require no schema change if payment records retain accounting-currency values.
- Generic `/api/decrypt` and plaintext server-share route removal require no schema change.
- Disclosure could superficially reuse `processing_started_at`, but that cannot fence a stale worker; production-correct multi-replica recovery requires lease columns (and recipient lease state).
- Export durability/claim recovery requires schema changes under the selected PostgreSQL-artifact design.

## Files to Modify

- `frontend/src/lib/db/schema.ts` - disclosure/export lease fields, durable export artifact fields, supporting indexes.
- `frontend/src/lib/cron/process-reminders.ts` - fenced claims, recovery, database-derived completion.
- `frontend/src/lib/cron/disclosure-helpers.ts` - typed fenced recipient state transitions.
- `frontend/src/lib/db/queries/secrets.ts` - processing/terminal disclosure semantics.
- `frontend/src/lib/db/secret-mapper.ts` - do not report in-flight rows as terminal disclosure.
- `frontend/src/lib/cron/process-exports.ts` - atomic batch claim, stale recovery, fenced finalization.
- `frontend/src/lib/cron/cleanup-exports.ts` - durable artifact cleanup.
- `frontend/src/lib/gdpr/export-service.ts` - remove `/tmp`, persist/stream durable artifact, atomic quota.
- `frontend/src/routes/api/user/export-data/+server.ts` - request behavior and fail-closed handling.
- `frontend/src/routes/api/user/export-data/[jobId]/+server.ts` - read-only status and owner-bound download behavior.
- `frontend/src/lib/rate-limit-db.ts`, `frontend/src/lib/rate-limit.ts` - atomic upsert and explicit failure denial.
- `frontend/src/lib/auth/otp.ts`, `frontend/src/auth.ts`, OTP routes - challenge-scoped attempts and IP limiting.
- Checkout routes/components/constants/pricing - POST-only, server-owned allowlists/prices.
- BTCPay provider, webhook route, and webhook handler - canonical full invoice metadata/currency.
- Decrypt/server-share/export-share routes and callers - remove server plaintext response paths.
- Relevant OpenSpec change files and generated Drizzle migration artifacts.

## New Files

- `openspec/changes/harden-production-backend/{proposal.md,design.md,tasks.md}` and scoped spec deltas - approved contract for the cross-cutting change.
- `frontend/src/lib/cron/__tests__/process-reminders.test.ts` - multi-worker disclosure recovery/fencing tests.
- `frontend/src/lib/cron/__tests__/process-exports.test.ts` - multi-worker export recovery/fencing tests.
- `frontend/src/lib/gdpr/__tests__/export-service.test.ts` - durable artifact and quota tests.
- `frontend/src/lib/__tests__/rate-limit-db.test.ts` - atomic concurrency/outage tests.
- `frontend/src/lib/auth/__tests__/otp.test.ts` - challenge-scoped failure tests.
- New route/payment tests listed in tasks 4, 6, 8, 10, and 12.
- Drizzle-generated SQL/snapshot entry with sequence assigned by `drizzle-kit generate`.

## Dependencies

- Task 1 approval gates implementation.
- Tasks 2, 4, 6, 8, 10, and 12 are failing-test gates for tasks 3, 5, 7, 9, 11, and 13 respectively.
- Task 3 and task 5 depend on the schema design; task 14 generates one reviewed additive migration after both are finalized.
- Task 11 must land with its checkout UI/auth-return callers so removing GET does not break purchase flow.
- Task 13 depends on identifying and updating all existing callers of the three flagged routes, but must not expand into unrelated cryptographic redesign.
- Task 15 depends on all implementation and migration tasks.

## Risks

- Email APIs do not provide a database transaction with delivery. The proposed at-least-once design prevents silent recipient loss but cannot eliminate a duplicate after provider acceptance and pre-commit crash. Provider idempotency should be used if the configured adapter supports it; otherwise this residual must be accepted and monitored.
- PostgreSQL artifact storage is concrete and replica-safe but duplicates sensitive export data and can increase database/WAL/backup size. Enforce a conservative maximum size and short retention. Moving to S3-compatible storage requires credentials/lifecycle policy and should be a separate approved operational change, not an implicit dependency.
- The exact safe lease duration must exceed normal provider/export latency while remaining short enough for recovery. Configure it centrally and validate with staging timing; workers must not extend/finalize a lease they no longer own.
- Existing `triggered` rows are ambiguous unless `triggered_at` is used as the terminal marker. Reconciliation must inspect only this known distinction and must not bulk-reset terminal disclosures.
- Removing checkout GET changes the post-auth redirect flow; route and UI/auth continuation must ship atomically.
- BTCPay invoice shapes differ by provider/version. Introduce a typed canonical mapper and fixture it with the deployed BTCPay payload; never fall back to permissive `any` metadata for subscription activation.
- The request describes “plaintext DB token server-share decryption paths” without naming every intended caller. This plan confines removal to the known generic decrypt, server-share, and export-share HTTP paths while retaining scheduled/manual delivery. If the intent is to eliminate server-held decryption capability entirely, that is a larger cryptographic/product redesign requiring an explicit decision and separate proposal.
- No new vulnerability search or dependency/security scan is included, per instruction.