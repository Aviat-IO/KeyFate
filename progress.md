# Production Remediation Progress

## Status

**NO-GO.** The current `review/production-remediation` worktree is an uncommitted local candidate. A local image was built, but it has no immutable source SHA, green GitHub run, credentialed staging evidence, or production approval.

The older SHA/image/test counts in `docs/plans/2026-07-11-production-readiness-evidence.md` are historical and do not validate this tree.

## Completed in the current local candidate

- Hardened production configuration, PostgreSQL transport, request/OTP/Turnstile handling, lifecycle shutdown, scheduler/disclosure/export fencing, readiness, and logging.
- Added native Signet Bitcoin setup with exact-address funding discovery, recipient-controlled destination, real Nostr/K bindings, continuity-kit v2 download/import, atomic refresh, replacement-kit download, and fail-closed production gating.
- Added non-credentialed Playwright CSP/probe/recovery smoke coverage and credential-gated staging scaffolding.
- Added production dependency audit policy and patched runtime dependency versions; three exact lockfile-only build-tool advisories remain documented and are proven absent from a fresh production-only install.
- Strengthened CI migration metadata/retry checks, browser smoke, OCI revision assertion, and Docker readiness over verified PostgreSQL TLS.
- Replaced dangerous GCP/reset/over-source restore instructions with Railway and isolation-only procedures; marked historical evidence/design files clearly.

## Current local validation

- `bun install --frozen-lockfile`: pass.
- `bun run lint`: pass.
- `bun run check`: pass, 0 errors and 0 warnings.
- `bun test`: pass, 626 passed and 5 PostgreSQL tests skipped by the default suite (631 total).
- `bun run test:browser`: pass, 4 Chromium journeys.
- `bun run audit:production`: pass; a fresh production-only install contains none of the packages behind the 3 exact lockfile-only advisories.
- `bun run build`: pass.
- `bunx drizzle-kit check`: pass with an isolated placeholder configuration value (no connection required).
- `bunx @fission-ai/openspec@1.6.0 validate harden-production-readiness --strict`: pass.
- Focused Signet/Bitcoin, outpoint/broadcast binding, check-in lease, send-now fencing, health, and production-config suites: pass.
- PostgreSQL 16.9 concurrency/fencing and `0008` compatibility suite: pass, 5 tests and 34 expectations. This run caught and fixed stale `updateDisclosureLog` integration-test arguments.
- Fresh migration plus retry: pass; all 11 journal entries applied once and the second run remained at 11.
- Local production image `sha256:6f56daaba972e04589b6ce4c9199104fb768e5c4892bf9b875fa63c0b94c00bb`: build, UID 1001, app-only command, OCI revision binding, production-dependency pruning, liveness, and fail-closed readiness pass.
- Docker PostgreSQL verified-TLS path: migration pass, readiness 200, 11 migration rows, and an observed `keyfate-app` SSL connection.
- Isolated logical backup/restore drill: pass; a custom-format dump restored into a separate database with the fixture user, secret, and all 11 migration rows intact. This does not substitute for Railway managed backup/PITR evidence.

Not rerun in this session:

- GitHub Actions workflow on an exact committed SHA.
- Piolium final report validation after this expanded diff.

Independent follow-up review verified the check-in/refresh coupling, shared mutation gate, local transaction-ID authority, exact funding/outpoint validation, disclosure lease fencing, readiness deduplication, dependency audit, documentation cleanup, and CI source logic. It found no new blocker/high regression. The known broadcast/persist/kit ordering remains medium while production is disabled and high/release-blocking before any funded enablement; an order-dependent Bun mock finding was fixed and the combined suites now pass in both orders.

## Remaining engineering work

- Replace Bitcoin broadcast-first setup/refresh with an idempotent prepare → encrypted-kit download → broadcast → exact-output finalize lifecycle before any Signet enablement.
- Add deterministic browser automation for Bitcoin setup download, browser restart, continuity import, refresh, accepted-then-timeout reconciliation, stale-generation rejection, and recipient recovery.
- Complete the broader credentialed browser/security journeys.
- Retire the legacy ESLint suppression baseline without increasing it.
- Review the full diff, remove accidental artifacts, run every final gate, and create a reviewable commit/PR only with explicit authorization.

## External release gates

Named human owners must still configure and evidence GitHub/Railway controls, OAuth/Turnstile/SendGrid/Stripe/BTCPay, live Nostr, funded Signet, managed backup/PITR restore, monitoring/alert delivery, incident/rollback drills, credential rotation, and final exact-SHA production promotion.

Canonical status and gates: [`TODO.md`](TODO.md), [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md), and [`docs/plans/railway-deployment-runbook.md`](docs/plans/railway-deployment-runbook.md).
