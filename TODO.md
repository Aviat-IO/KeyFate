# KeyFate Production Readiness TODO

## Current status

**Release verdict: NO-GO. Do not promote to production yet.**

The last audited revision was `b7b7aef1a897c418e0402acd211fecf0206d8217`. The current `review/production-remediation` tree contains further uncommitted work and is not a releasable artifact. A current local image exists, but there is no immutable source SHA or exact-SHA CI artifact.

### Completed locally

- [x] Confirmed H1 and M1–M7 source paths removed or fenced.
- [x] Atomic PostgreSQL rate limiting and challenge-scoped, consume-once OTP validation.
- [x] Crash-safe disclosure/export leases, stale-worker fencing, recipient deduplication, and durable export artifacts.
- [x] Removed generic decryption and plaintext server-share recovery routes.
- [x] Browser-owned Nostr recovery v2 with strict event, publisher, recipient, manifest, and capsule verification.
- [x] No recipient share, K, passphrase, publisher secret, or private wallet key crosses the server boundary in the tested creation flow.
- [x] Bitcoin recovery envelopes, branch-key zeroization, generation checks, and atomic storage endpoints tested.
- [x] Enforcing CSP, fixed Markdown sanitization, liveness/readiness separation, non-root runtime, and production dependency pruning.
- [x] Railway Config-as-Code uses one deployment-level migration command; replicas do not run migrations at startup.
- [x] The current default suite passes 626 tests with 5 PostgreSQL tests explicitly skipped and 0 failures.
- [x] The current local lint, Svelte/TypeScript check, production build, Drizzle metadata check, production dependency audit, and 4 non-credentialed Chromium security journeys pass.
- [x] CI now defines migration metadata/retry checks, browser smoke, OCI revision verification, and successful Docker readiness over verified PostgreSQL TLS.
- [x] Strict OpenSpec validation passes for the current local tree.
- [x] Independent follow-up review verified the targeted Bitcoin/backend/operations fixes; no new blocker or high finding was found. The known two-phase Bitcoin lifecycle remains release-blocking before enablement.
- [x] PostgreSQL concurrency/fencing and migration compatibility pass: 5 tests, 34 expectations, and 11 idempotent migration journal rows.
- [x] The current local Docker image passes non-root/pruning/provenance checks, fail-closed readiness, and successful production readiness over verified PostgreSQL TLS.
- [x] An isolated logical dump/restore preserved the fixture user, secret, and all 11 migration rows; Railway managed backup/PITR proof remains external.
- [ ] Run the Piolium gate and exact-SHA GitHub workflow after the final diff is committed.

### Known incomplete work

- [x] The owner Bitcoin setup workflow is wired behind the server-owned fail-closed Signet gate.
- [x] The encrypted Bitcoin continuity-kit v2 download/import workflow is wired with strict restart bindings and a v1 re-enrollment path.
- [x] The Bitcoin refresh workflow invokes the client broadcast operation and atomic generation-fenced endpoint, then requires a replacement kit download.
- [ ] Bitcoin enrollment remains hard-disabled in production pending funded Signet evidence and approval.
- [ ] The legacy ESLint baseline remains and must be retired incrementally.
- [ ] Credentialed CSP browser journeys have not been completed.
- [ ] GitHub, Railway, provider, live-relay, backup/PITR, monitoring, and production-promotion controls remain unverified.

## Non-negotiable guardrails

- Keep `BITCOIN_ENROLLMENT_ENABLED=false` until every Bitcoin gate below passes.
- Never send or store plaintext recipient shares, K values, passphrases, publisher secret keys, private wallet keys, or threshold sets on the server.
- Never persist plaintext recovery material in `localStorage` or `sessionStorage`.
- Use only generated Drizzle migrations. Do not hand-author or edit generated migration SQL or snapshots.
- Run migrations once through Railway `preDeployCommand`; never from the application entrypoint or each replica.
- Treat disclosure email as at-least-once delivery. State fencing cannot guarantee exactly-once provider transport after provider acceptance.
- Do not use `railway up`; use the linked-branch deployment configured for the service.
- Do not call the local image digest a production artifact. Production evidence must bind an exact green Git SHA to the deployed image/revision.
- Do not delete required `piolium/`, `.pi-subagents/`, SBOM, scanner, plan, or audit artifacts merely to satisfy aggregate cleanup lint.
- Do not claim RPO, RTO, SLA, uptime, backup, relay, provider, or signet guarantees without retained credentialed evidence.

## Next tasks — engineering work

These tasks can be implemented and tested by an engineering agent, but must still receive human review before release.

### P0 — complete the Bitcoin owner workflow

- [x] Build an owner-only Bitcoin setup UI behind the disabled feature gate.
- [x] Require a recipient-controlled Bitcoin address; never create or retain a recipient wallet private key for the owner.
- [x] Use the real browser-held K and Nostr capsule/event binding. Do not reintroduce placeholder or all-zero values.
- [x] Generate a fresh one-time branch key for each setup/refresh and zero it on every success and failure path.
- [x] Create the complete delayed recipient transaction and encrypt it for the intended recipient before upload.
- [x] Upload only public lifecycle metadata and the recipient-encrypted envelope to `/store-bitcoin`.
- [x] Require an encrypted owner continuity-kit download before setup is considered complete.
- [x] Add continuity-kit import with passphrase validation entirely in the browser.
- [x] Wire refresh to `refreshBitcoinClient` and `/store-bitcoin-refresh`.
- [x] Couple a Bitcoin-enabled service check-in to atomic persistence of the next Bitcoin generation; reject ordinary check-in and live-disclosure races.
- [ ] Replace broadcast-first setup/refresh with an idempotent prepare → encrypted-kit download → broadcast → exact-output finalize lifecycle that survives accepted-then-timeout, persistence failure, and retry without stranding a generation.
- [ ] Add browser tests for setup, explicit download, tab/browser restart, continuity import, refresh, stale-generation rejection, accepted-then-timeout reconciliation, and recipient recovery.
- [ ] Keep production enrollment disabled after implementation until the human-funded Signet gate passes.

### P1 — retire the lint baseline

- [ ] Reduce legacy ESLint violations in small reviewable groups.
- [ ] Update `frontend/eslint-suppressions.json` only by removing resolved counts.
- [ ] Never regenerate or increase the baseline merely to make CI green.
- [ ] Remove `frontend/ESLINT_BASELINE.md` and the count-based exception only when ordinary strict lint passes without suppressions.

### P1 — complete browser/security journeys

- [ ] Add or run enforcing-CSP browser journeys for sign-in, OAuth callback, Turnstile, secret creation, encrypted recovery-kit export, Nostr recovery, Bitcoin recovery, and data export.
- [ ] Verify no secrets appear in request bodies, URLs, browser storage, logs, analytics, or error telemetry.
- [ ] Exercise tampered Nostr events, stale Bitcoin generations, provider errors, expired capabilities, and concurrent retries.

### P1 — prepare a reviewable release commit

- [ ] Review the full remediation diff and remove accidental or unrelated files.
- [ ] Preserve all required audit and evidence artifacts.
- [ ] Commit the candidate with all generated Drizzle SQL, snapshots, and journal changes together.
- [ ] Open a pull request and require all CI jobs to pass on the exact commit SHA.
- [ ] Rebuild evidence using the committed SHA; replace the `uncommitted-remediation-candidate` label only after provenance is real.

## Manual work required from a human

The following work requires account authority, credentials, funds, private keys, risk acceptance, or an explicit production decision. An agent must not silently perform it.

### 1. Assign owners and approve the release process

- [ ] **[HUMAN]** Assign a named owner for security, Railway operations, database recovery, monitoring/on-call, billing/providers, Nostr, and Bitcoin.
- [ ] **[HUMAN]** Review and approve the remediation pull request.
- [ ] **[HUMAN]** Decide who has authority to approve staging and production promotion.
- [ ] **[HUMAN]** Record any accepted residual risk in writing; do not imply acceptance from silence.

### 2. Configure GitHub release controls

- [ ] **[HUMAN — GitHub admin]** Require the lint/typecheck, test, dependency-audit, migration, build, browser, and Docker/runtime jobs on protected branches.
- [ ] **[HUMAN — GitHub admin]** Enable branch protection/rulesets, prevent bypass where appropriate, and require review.
- [ ] **[HUMAN — GitHub admin]** Configure the production environment approval gate.
- [ ] **[HUMAN — GitHub admin]** Retain the green workflow URL and exact Git SHA used for staging.

### 3. Verify Railway configuration in staging

- [ ] **[HUMAN — Railway admin]** Confirm the service root is `/frontend` and Config-as-Code detects `frontend/railway.json`.
- [ ] **[HUMAN — Railway admin]** Confirm the effective pre-deploy command is exactly `bun run db:migrate:production` once.
- [ ] **[HUMAN — Railway admin]** Remove any duplicate migration/start override from the Railway UI.
- [ ] **[HUMAN — Railway admin]** Confirm deployments wait for required green CI and require production approval.
- [ ] **[HUMAN — Railway admin]** Deploy the exact approved SHA to staging through the linked branch. Do not use `railway up`.
- [ ] **[HUMAN]** Verify migration logs show `Database migrations completed.` and that a retry does not add journal rows.
- [ ] **[HUMAN]** Verify overlapping replicas contain no application-start migration logs.
- [ ] **[HUMAN]** Retain deployment ID, Git SHA, image/revision digest, timestamps, migration output, and health output.

### 4. Configure and test external providers

Do not paste provider secrets into this repository, TODO file, audit evidence, or chat. Enter them directly in the approved secret stores/provider consoles.

- [ ] **[HUMAN — credential owner]** Configure staging Google OAuth credentials and authorized callback URLs.
- [ ] **[HUMAN — credential owner]** Configure Turnstile staging keys and allowed domains.
- [ ] **[HUMAN — credential owner]** Configure SendGrid credentials, sender identity, suppression behavior, and test mailbox access.
- [ ] **[HUMAN — billing owner]** Configure Stripe staging products/prices, webhook secret, and test account.
- [ ] **[HUMAN — billing owner]** Configure BTCPay staging store, webhook secret, settlement currency, and test wallet.
- [ ] **[HUMAN]** Execute and retain successful and failure/replay evidence for OAuth, Turnstile, SendGrid, Stripe, BTCPay, scheduled jobs, exports, and CSP browser flows.

### 5. Run the live Nostr gate

- [ ] **[HUMAN — Nostr owner]** Select approved live relays and document availability/privacy expectations.
- [ ] **[HUMAN]** Use a dedicated test recipient key controlled by the tester; never disclose a real recipient nsec to the service or logs.
- [ ] **[HUMAN]** Run browser publication → live relay → query → unwrap → K recovery → share recovery.
- [ ] **[HUMAN]** Test invalid outer/seal/rumor signatures, wrong recipient, wrong publisher, conflicting manifests, relay outage, and retry behavior.
- [ ] **[HUMAN]** Retain relay URLs, event IDs/public keys, timestamps, sanitized logs, and pass/fail results. Do not retain private keys.

### 6. Fund and run the Bitcoin signet gate

- [ ] **[HUMAN — Bitcoin owner]** Provide signet funds and a dedicated recipient-controlled signet address.
- [ ] **[HUMAN]** Keep owner/recipient private keys outside the service and evidence logs.
- [ ] **[HUMAN]** Execute setup through the production owner workflow after it is wired.
- [ ] **[HUMAN]** Confirm the funding transaction, script, amount, fees, CSV delay, recipient output, and complete signature.
- [ ] **[HUMAN]** Download the encrypted continuity kit, close/restart the browser, import it, and perform a refresh.
- [ ] **[HUMAN]** Confirm the new generation is persisted before the old generation is superseded and stale generations are rejected.
- [ ] **[HUMAN]** Recover as the actual recipient from the latest disclosure artifact and broadcast only after the delay is valid.
- [ ] **[HUMAN]** Retain public transaction IDs, block heights, generation numbers, sanitized browser evidence, and pass/fail results.
- [ ] **[HUMAN — security/product approval]** Enable Bitcoin enrollment only after every signet assertion passes and the evidence is reviewed.

### 7. Enable and drill database backups/PITR

- [ ] **[HUMAN — Railway/database admin]** Enable and verify Railway PostgreSQL backup/PITR settings and retention.
- [ ] **[HUMAN]** Restore a production-like backup into an isolated database, never over the source database.
- [ ] **[HUMAN]** Validate migration journal, users/secrets, disclosure leases/logs, export artifacts, Nostr public metadata, and Bitcoin generations after restore.
- [ ] **[HUMAN]** Measure and record actual RPO and RTO; do not copy desired targets into evidence as measured results.
- [ ] **[HUMAN]** Record the restore owner, timestamps, backup identifier, verification queries, and destruction/retention of the isolated copy.

### 8. Configure monitoring and run incident/rollback drills

- [ ] **[HUMAN — operations owner]** Configure alert destinations and verify delivery to an accountable person.
- [ ] **[HUMAN]** Monitor liveness, readiness, database connectivity/pool failures, cron freshness, stale disclosure/export leases, provider failures, email delivery, webhook replay/failure, and backup status.
- [ ] **[HUMAN]** Run a rolling-deploy interruption during disclosure/export processing and verify takeover plus stale-worker fencing.
- [ ] **[HUMAN]** Run provider-accepted-then-crash exercises and confirm state fencing while documenting possible duplicate delivery.
- [ ] **[HUMAN]** Drill application rollback while leaving additive migrations `0009` and `0010` in place.
- [ ] **[HUMAN]** Verify the previous green image becomes healthy and no ad hoc down migration is used.
- [ ] **[HUMAN]** Record alert delivery, incident owner, timeline, rollback revision, recovery result, and observed gaps.

### 9. Rotate and verify credentials

- [ ] **[HUMAN — credential owners]** Rotate production-sensitive provider, OAuth, webhook, cron, and application secrets according to the approved sequence.
- [ ] **[HUMAN]** Verify the application remains healthy after rotation and old credentials no longer work.
- [ ] **[HUMAN]** Retain only key identifiers/versions and timestamps—not secret values—in evidence.

### 10. Final promotion decision

- [ ] **[HUMAN — accountable approver]** Confirm every required GitHub check is green for the exact release SHA.
- [ ] **[HUMAN — accountable approver]** Confirm all repository tasks above are complete or explicitly risk-accepted.
- [ ] **[HUMAN — accountable approver]** Confirm staging provider, live Nostr, funded signet, backup/PITR, monitoring, rollback, and key-rotation evidence is retained.
- [ ] **[HUMAN — accountable approver]** Promote that exact approved SHA/revision to production.
- [ ] **[HUMAN]** Re-run live/readiness and critical user journeys after promotion.
- [ ] **[HUMAN]** Record the final production deployment ID, Git SHA, image/revision digest, approval, timestamps, and rollback target.

## Required final validation

Run after every repository change and again on the exact release commit:

```bash
cd frontend
bun install --frozen-lockfile
bun run lint
bun run check
bun test
bun run test:browser
bun run audit:production
bun run build
```

Run the PostgreSQL and migration gates against an isolated PostgreSQL database:

```bash
cd frontend
TEST_DATABASE_URL='<isolated-postgresql-url>' \
DATABASE_URL='<isolated-postgresql-url>' \
bun test scripts/postgres-concurrency.test.ts scripts/migration-compatibility.test.ts

DATABASE_URL='<isolated-postgresql-url>' bun run db:migrate:production
DATABASE_URL='<isolated-postgresql-url>' bunx drizzle-kit check
```

Validate the specification and final audit report:

```bash
bunx @fission-ai/openspec@latest validate harden-production-readiness --strict
python3 /Users/alancolver/.pi/agent/npm/node_modules/@vigolium/piolium/skills/audit/hooks/scripts/validate_phase_output.py 15 piolium
```

The aggregate Piolium cleanup lint is expected to report preserved scanner/SBOM artifacts. Do not delete required evidence to make that aggregate cleanup check pass.

## Evidence to retain for every external gate

Use this minimum record:

```text
Gate:
Environment:
Named owner:
Date/time (UTC):
Exact Git SHA:
Deployed image/revision digest:
Command or workflow URL:
Sanitized output/log location:
Pass/fail result:
Observed limitations:
Rollback target:
Approver:
```

Canonical references:

- `openspec/changes/harden-production-readiness/tasks.md`
- `docs/plans/2026-07-11-production-readiness-evidence.md`
- `docs/plans/railway-deployment-runbook.md`
- `piolium/final-audit-report.md`
- `piolium/audit-state.json`

Production readiness is achieved only when the remaining repository tasks and every credentialed external/manual gate above have retained evidence and accountable approval.
