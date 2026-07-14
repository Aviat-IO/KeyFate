# KeyFate remediation candidate evidence — 2026-07-11

## Verdict

**NO-GO for production promotion.** The repository-level remediation candidate passes its implemented local gates and
closes the confirmed H1 and M1–M7 source paths, but the production owner Bitcoin setup/continuity/refresh workflow is
not wired. Credentialed Railway/provider, live Nostr relay, Railway backup/PITR, and funded Bitcoin signet gates remain
unobserved. Bitcoin enrollment remains fail-closed.

Audit target: `b7b7aef1a897c418e0402acd211fecf0206d8217`  
Final local image: `sha256:24ccc60c9f454482da6788eb0a6f5ae911d00517da119beb7f107605b269165e`  
Image provenance: local `uncommitted-remediation-candidate`; it is not labeled as the audited commit or a production artifact.

## Local release-candidate gates

| Gate                       | Result | Evidence summary                                                                                                                                                                                     |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency install  | PASS   | Bun 1.3.14 accepted `bun install --frozen-lockfile`.                                                                                                                                                 |
| Formatting/lint            | PASS   | Prettier passes; ESLint uses the count-based baseline captured from the audited commit, so new violations fail.                                                                                      |
| Svelte/TypeScript          | PASS   | `svelte-check found 0 errors and 0 warnings`.                                                                                                                                                        |
| Default tests              | PASS   | 581 passed, 5 explicitly skipped, 0 failed, and 1,371 expectations across 66 files. The skips are the separately executed PostgreSQL tests below.                                                    |
| PostgreSQL integration     | PASS   | 5 passed and 34 expectations: rate-limit concurrency, parent/recipient and export takeover fencing, OTP expiry/consume-once, `0008` upgrade, legacy duplicate convergence, and mixed-version writes. |
| Build                      | PASS   | SvelteKit adapter-node production build completed.                                                                                                                                                   |
| Drizzle metadata           | PASS   | `drizzle-kit check`: `Everything's fine`.                                                                                                                                                            |
| Fresh migration            | PASS   | PostgreSQL 16.9 applied 11 journal entries through generated migration `0010`.                                                                                                                       |
| Migration retry            | PASS   | A second `db:migrate:production` run remained at 11 entries.                                                                                                                                         |
| Upgrade compatibility      | PASS   | An `0008` database with duplicate legacy disclosure rows upgraded through `0010`; new claims converged on one deterministic key and old-replica writes worked.                                       |
| Local backup/restore       | PASS   | A PostgreSQL custom-format logical backup restored into an isolated database with all 11 journal entries and required recovery/export columns.                                                       |
| Piolium phase 15           | PASS   | Final audit report validator passed.                                                                                                                                                                 |
| Docker build               | PASS   | Pinned Bun 1.3.14 multi-stage image built with the image ID above.                                                                                                                                   |
| Runtime user/start         | PASS   | UID 1001; app-only `CMD ["bun", "run", "build/index.js"]`.                                                                                                                                           |
| Runtime dependency pruning | PASS   | Vite, adapter-node, Svelte Vite plugin, TypeScript, ESLint, Prettier, Drizzle Kit, and Vitest are absent; required runtime packages remain.                                                          |
| Liveness                   | PASS   | `/api/health/live` returned 200 without a database.                                                                                                                                                  |
| Readiness fail-closed      | PASS   | `/api/health/ready` returned 503 without a database.                                                                                                                                                 |
| Readiness success          | PASS   | The production image returned 200 against freshly migrated TLS PostgreSQL; `pg_stat_ssl` confirmed all `keyfate-app` connections used TLS.                                                           |

Piolium's aggregate cleanup lint intentionally still reports preserved scanner/SBOM working artifacts. The user required
those artifacts to remain. Every individual phase validator (1–15) passed, and the exception is recorded in
`piolium/audit-state.json`.

## Confirmed implementation outcomes

- Atomic PostgreSQL rate-limit decisions fail closed, and concurrent first-use database initialization is single-flight.
- OTP failures mutate only the issued challenge and successful challenges are consumed once.
- Checkout creation is POST-only and entitlement derives from canonical Stripe/BTCPay plan, amount, currency, and interval.
- Generic decryption and plaintext owner-share retrieval endpoints are removed.
- Disclosure/export work uses expiring claims and fenced final writes; recipient claims lock and validate the live parent
  lease, stale workers cannot steal replacement ownership, terminal rows cannot reacquire leases, and deterministic unique
  keys converge new claims while retaining legacy audit rows. Export artifacts are bounded, hashed, compressed, durable PostgreSQL data.
- Check-in capabilities are domain-separated hashes, claimed atomically, and no longer rely on query-string bearer tokens.
- Nostr recovery v2 is signed and browser-owned; the service accepts only opaque signed artifacts plus public bindings.
- Plaintext recovery material is tab-memory-only; durable owner kits are PBKDF2/AES-GCM encrypted downloads.
- Each recipient is assigned one distinct Shamir share, preventing a second recipient from receiving a different share
  through the manual channel in addition to their Nostr share.
- Bitcoin storage accepts recipient-encrypted complete recovery envelopes and public lifecycle metadata only.
- Bitcoin setup/refresh primitives use one-time branch keys that are zeroed in `finally`; the encrypted continuity-kit
  format and crypto tests do not yet have a production owner download/import caller.
- Scheduled and manual disclosure emails include the current encrypted Bitcoin artifact and separately state the
  database-selected current generation; recipient recovery rejects generation mismatches before broadcast.
- CSP is enforcing, the Markdown sanitizer is pinned/tested, and liveness/readiness semantics are separated.
- Railway Config-as-Code runs migrations at the deployment level; the Docker entrypoint does not migrate per replica.

## Repository-level work still open

- Retire the legacy ESLint baseline through incremental cleanup; it remains visible and cannot be regenerated merely to pass CI.
- Wire the existing encrypted Bitcoin setup, continuity-kit download/import, and refresh primitives into a production owner
  workflow, then validate that workflow. Branch-key zeroization, atomic storage endpoints, and recipient recovery tests pass locally.
- Bitcoin enrollment remains disabled by default until the owner workflow is complete and the external funded-signet gate passes.

## Credentialed external release gates

- Observe Railway applying exactly one pre-deploy migration for the exact green Git SHA and no replica-level migration.
- Require green GitHub checks, branch protection, deployment approval, and immutable SHA/image provenance.
- Exercise OAuth, Turnstile, SendGrid, Stripe, BTCPay, all scheduled jobs, exports, and enforcing CSP in staging.
- Run a live Nostr publisher → relay → recipient recovery round trip with tamper and outage cases.
- Fund and execute Bitcoin signet setup, delayed spend, refresh, browser restart, recipient recovery, and broadcast before enabling enrollment.
- Enable and verify Railway PostgreSQL backups/PITR; restore into isolation and record measured RPO/RTO.
- Capture monitoring, alert ownership, rollback, SLA, and key-rotation evidence.

Do not relabel the candidate production-ready until those gates have named owners and retained evidence.
