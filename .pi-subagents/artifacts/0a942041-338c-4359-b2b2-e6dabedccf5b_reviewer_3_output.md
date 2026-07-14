## Review

Audit target: repository HEAD `b7b7aef1a897c418e0402acd211fecf0206d8217`. This was a read-only source review; only this audit artifact was written. Requested `plan.md` is absent. `progress.md` says the branch was validated for a Bitcoin timelock demo and explicitly records that the full test suite had previously failed, but the current HEAD test suite passed during this audit.

### Correct

- `frontend/Dockerfile:19-39` creates and switches to an unprivileged UID/GID and owns only the application/export paths needed by that user.
- `frontend/migrate-and-start.sh:12-30` fails closed after ten failed migration attempts and uses `exec` for correct signal propagation to the application.
- `frontend/Dockerfile:4-5` uses the committed Bun lockfile with `--frozen-lockfile`.
- The primary health route checks database connectivity and required encryption/email configuration and returns `503` when degraded (`frontend/src/routes/api/health/+server.ts:43-63,94-96`). Detailed primary-health metrics and cron/pool metrics require the cron secret.
- Disclosure processing uses a database compare-and-set claim on `active -> triggered`, not merely the scheduler's process-local lock (`frontend/src/lib/cron/process-reminders.ts:102-117`), and recipient disclosure inserts use conflict handling (`frontend/src/lib/cron/process-reminders.ts:260-278`). This materially reduces duplicate disclosure risk during overlapping workers.
- Current local validation passed type/Svelte checking, all 549 tests, and the production build.

### Blocker

- **Known Critical/High production dependency vulnerabilities are shipped, and CI has no vulnerability gate.** `frontend/package.json:47,81,84,90` declares affected Svelte, Nodemailer, `sanitize-html`, and Vite ranges. `bun audit --production` reported **46 vulnerabilities: 1 critical, 15 high, 27 moderate, 3 low**, including critical `sanitize-html` XSS (GHSA-rpr9-rxv7-x643), high Nodemailer file-read/SSRF, multiple high Axios credential/prototype-pollution issues through SendGrid, and high `devalue` DoS. The affected sanitizer is directly used before an HTML sink at `frontend/src/routes/blog/[slug]/+page.svelte:6,12-14,139`. CI only lint/check/test/builds (`.github/workflows/ci.yml:19-80`) and does not run an audit, image scan, SBOM, or policy threshold. Production release should be blocked until the lockfile is updated and the production audit is clean at the agreed severity threshold.

- **Repository evidence shows production is not release-verified, while Railway deploys directly from pushes rather than from a successful CI/release job.** The project deployment instructions say Railway automatically deploys every push (`AGENTS.md:119-123`), but the workflow contains no deploy job or environment approval and therefore cannot make deployment depend on its successful jobs (`.github/workflows/ci.yml:3-13,19-80`). The production checklist still leaves DNS/TLS cutover, OAuth callback, Stripe webhook, and production E2E unchecked (`docs/plans/migration-testing-checklist.md:69-79`); `TODO.md:12-28` additionally leaves the full smoke test and Railway production root directory unchecked. A failing test/audit can race with or follow an already-started production deploy. Gate production promotion on a successful immutable artifact, protected environment approval, migration/backup checks, and post-deploy smoke/rollback checks.

- **Backup/recovery evidence is not applicable to the deployed platform and no restore drill is demonstrated.** The canonical recovery document claims Cloud SQL and provides `gcloud`/Kubernetes procedures (`docs/database-backup-procedures.md:3-27,48-87`), while the Railway checklist only states that paid Railway offers snapshots/PITR (`docs/plans/migration-testing-checklist.md:81-87`) without showing that the plan is enabled, backup freshness is monitored, encryption/retention are acceptable, or a Railway restore met RPO/RTO. For a dead-man's-switch service, an unverified restore path is a release blocker. Add Railway-specific backup ownership, off-platform/region strategy as appropriate, automated freshness alerts, restore instructions, and timestamped restore-drill evidence before relying on production data.

### Medium+ findings

- **High — No Content Security Policy protects multiple HTML/script sinks.** The global headers include frame, MIME, referrer, permissions, and HSTS headers but no `Content-Security-Policy` (`frontend/src/hooks.server.ts:68-84`), and SvelteKit has no CSP configuration (`frontend/svelte.config.js:5-13`). The blog renders sanitized HTML and an inline JSON-LD script via `{@html}` (`frontend/src/routes/blog/[slug]/+page.svelte:79,139`), increasing the impact of sanitizer/framework XSS defects. Add a nonce/hash-based enforced CSP (not only report-only), test it on hosted production responses, and avoid raw script construction where possible.

- **High — Required production configuration validation is fail-open and incomplete.** `validateAuthEnvironment` only logs missing/invalid variables and still returns to startup (`frontend/src/lib/auth/validate-env.ts:16-49`); its module-load call ignores the result (`:52-55`). It validates neither `DATABASE_URL`, `ENCRYPTION_KEY`, `SENDGRID_API_KEY`, `CRON_SECRET`, nor selected payment-provider secrets. Payment/encryption getters defer failure until a feature is exercised (`frontend/src/lib/server-env.ts:9-67`), while cron defaults enabled unless explicitly set to the exact string `false` (`frontend/src/lib/cron/scheduler.ts:109-114`). Introduce one typed startup schema with production-specific requirements and bounds/base64/URL checks, fail startup on invalid required configuration, and test representative Railway variable sets.

- **High — Production logs contain customer metadata/PII and portions of webhook material outside the structured sanitizer.** The unauthenticated check-in endpoint logs client IP and token fingerprint via raw console (`frontend/src/routes/api/check-in/+server.ts:57-68`), then logs secret titles/IDs on failure and success (`:182-188,203-207,234-241`) and production stack/error objects (`:256-261`). BTCPay logging emits the first 20 characters of received/expected signatures and up to 200 characters of raw webhook data (`frontend/src/lib/payment/providers/BTCPayProvider.ts:224-249`). Cron structured logs also include recipient emails and secret titles (for example `frontend/src/lib/cron/process-reminders.ts:80-87,147-152,202-223`); the logger masks only a key exactly equal to `email`, so arrays under `recipientEmails` are not masked (`frontend/src/lib/logger.ts:49-61`). Use the structured logger everywhere, redact by value/type and nested key, omit titles/raw payloads/signature fragments/IPs unless justified, define retention/access controls, and add log-redaction tests.

- **Medium — Public health endpoints disclose database internals and raw errors.** `/api/health/db` has no authorization and returns configured pool values plus `healthCheck.error` (`frontend/src/routes/api/health/db/+server.ts:10-35`), and returns caught raw error messages (`:42-54`). `/api/health/database` similarly publishes connection attempts, circuit-breaker timestamps, last successful connection, and caught error messages without auth (`frontend/src/routes/api/health/database/+server.ts:31-58,60-79`). Keep one minimal unauthenticated liveness/readiness response; put operational detail behind admin/monitor authentication and sanitize errors.

- **Medium — Runtime image and build provenance are mutable and unnecessarily broad.** All three stages use mutable `oven/bun:1`/`1-slim` tags rather than versions plus digests (`frontend/Dockerfile:2,8,15`). The runtime copies the complete development `node_modules` tree (`:23-28`), including build/migration tooling, and owns all `/app` recursively (`:37-39`). There is no image `HEALTHCHECK`, read-only root filesystem declaration, capability policy, seccomp policy, SBOM, signature, or image scan. Pin base images by digest, prune/build a production dependency set (or isolate migration tooling), minimize write permissions, and enforce runtime restrictions in checked-in Railway/deployment configuration.

- **Medium — CI supply chain and toolchain are not reproducible enough for release assurance.** Actions are mutable major tags rather than commit SHAs (`.github/workflows/ci.yml:24-26,43-45,60-62,77`), Bun is `latest` (`:27-28,46-47,63-64`), runners are mutable `ubuntu-latest`, and no top-level least-privilege `permissions` is declared. Docker also resolves mutable base tags. Pin action SHAs, Bun, runner/base versions and image digests; declare `contents: read`; add dependency review, secret scanning, audit, container scan, SBOM/provenance, and artifact signing/attestation gates.

- **Medium — Failure handling can leave a compromised process serving traffic.** `uncaughtException` exits, but `unhandledRejection` only logs and continues (`frontend/src/hooks.server.ts:92-103`). Node/Bun application state after an unhandled rejection is not guaranteed safe. Stop accepting traffic, stop cron tasks, close DB connections, and exit nonzero so Railway restarts the instance; test shutdown/restart and in-flight job recovery.

- **Medium — Migrations are coupled to every application instance startup without a demonstrated backup/rollback gate.** Every container runs Drizzle migration before serving (`frontend/Dockerfile:45`; `frontend/migrate-and-start.sh:12-30`). Failure prevents startup (good), but the repository does not prove single-run deployment semantics, backwards-compatible expand/contract migrations, a pre-migration backup, concurrent-start behavior, or rollback after a partially compatible application rollout. Move migration to a single release/predeploy phase or prove advisory-lock/concurrency safety, and test old/new version overlap plus rollback against a production-shaped database.

- **Medium — Operational monitoring is mostly pull/log based and does not demonstrate alert delivery.** The in-process scheduler starts in every enabled instance (`frontend/src/hooks.server.ts:103`; `frontend/src/lib/cron/scheduler.ts:109-128`), while its overlap guard is process-local (`:85-104`). Although disclosure claims are DB-safe, other jobs and monitoring must still tolerate replica/deploy overlap. Repo evidence contains health endpoints and logs but no checked-in alerting integration for missed/stale cron execution, backup age, health failures, queue/email failures, migration failure, or restart loops. Validate replica count and rolling deploy overlap in Railway; add durable last-success/freshness signals and credentialed synthetic alerts with escalation/runbooks.

- **Medium validation gap — Railway/TLS controls are dashboard-only and cannot be independently reviewed from HEAD.** No tracked `railway.toml`/`railway.json` defines health path/timeouts, restart policy, replicas, resource limits, region, deploy branch, predeploy command, or domain. The checklist says Railway will auto-provision TLS but leaves custom-domain DNS/TLS unchecked (`docs/plans/migration-testing-checklist.md:69-73`). Capture non-secret Railway configuration as code or exported evidence and validate TLS versions/ciphers, certificate renewal, HSTS on both Railway/custom domains, HTTP redirect behavior, and security headers from the hosted service.

### Concrete release validation still required

1. Clean `bun audit --production` at the release threshold and scan the final image, not only the workspace lockfile.
2. Build once, generate SBOM/provenance, sign, promote the same digest staging → production, and prove Railway waits for required checks/approval.
3. Hosted checks for HTTP→HTTPS, TLS/cert chain/renewal, HSTS, enforced CSP, all security headers, health path, restart behavior, and custom domain.
4. Production-shaped migration concurrency/rollback test plus verified pre-migration backup.
5. Railway backup freshness check and timed restore drill with integrity verification and recorded RPO/RTO.
6. Replica/rolling-deploy cron overlap, process crash mid-disclosure, email/provider outage, DB outage/recovery, and stale-cron alert tests.
7. Credentialed end-to-end smoke tests for OAuth, check-in, secret release, Stripe webhook, and notification delivery; the repository checklist currently marks these incomplete.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Performed only the requested adversarial read-only infrastructure/production audit at HEAD b7b7aef1; no project/source files were edited."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Findings cite exact repository files/lines and include local check, full-test, build, dependency-audit, git-status, and staged-file validation results."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/0a942041-338c-4359-b2b2-e6dabedccf5b/audit/infra-prod-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git rev-parse HEAD && git status --short && git log -1 --oneline",
      "result": "passed",
      "summary": "Confirmed target HEAD b7b7aef1a897c418e0402acd211fecf0206d8217 and inspected worktree state."
    },
    {
      "command": "cd frontend && bun run check",
      "result": "passed",
      "summary": "Svelte/TypeScript check completed successfully."
    },
    {
      "command": "cd frontend && bun test",
      "result": "passed",
      "summary": "549 tests passed, 0 failed."
    },
    {
      "command": "cd frontend && bun run build",
      "result": "passed",
      "summary": "Production adapter-node build completed successfully."
    },
    {
      "command": "cd frontend && bun audit --production",
      "result": "failed",
      "summary": "Reported 46 vulnerabilities: 1 critical, 15 high, 27 moderate, and 3 low."
    },
    {
      "command": "git diff --cached --name-only && git diff --name-only",
      "result": "passed",
      "summary": "No staged or tracked source changes were present."
    }
  ],
  "validationOutput": [
    "HEAD: b7b7aef1a897c418e0402acd211fecf0206d8217",
    "bun version: 1.3.14",
    "bun test: 549 pass, 0 fail",
    "bun run check: exit 0",
    "bun run build: exit 0",
    "bun audit --production: 46 vulnerabilities (1 critical, 15 high, 27 moderate, 3 low), exit 1",
    "git diff --cached --name-only: empty"
  ],
  "residualRisks": [
    "Live Railway dashboard configuration, deployment history, TLS posture, secrets, backups, logs, alerts, and hosted endpoints were not accessible from repository evidence and require credentialed validation.",
    "No Docker image build/runtime test or final-image CVE scan was performed locally; CI defines only a build test.",
    "Running the repository build generated an untracked piolium/ audit-state directory; it was not staged or edited as source. Pre-existing untracked progress/planning files were left untouched.",
    "Requested plan.md was absent; progress.md was read."
  ],
  "noStagedFiles": true,
  "diffSummary": "No project/source diff; added only the required audit report artifact.",
  "reviewFindings": [
    "blocker: frontend/package.json:47,81,84,90 - production audit reports 1 critical and 15 high vulnerabilities with no CI audit gate",
    "blocker: .github/workflows/ci.yml:3-80 and AGENTS.md:119-123 - Railway push deploy is not gated on successful CI/release approval",
    "blocker: docs/database-backup-procedures.md:3-27 - recovery runbook targets obsolete Cloud SQL rather than deployed Railway and no restore drill is evidenced",
    "high: frontend/src/hooks.server.ts:68-84 - no Content-Security-Policy despite raw HTML/script sinks",
    "high: frontend/src/lib/auth/validate-env.ts:16-55 - production environment validation logs but does not fail startup",
    "high: frontend/src/routes/api/check-in/+server.ts:57-68,182-188,234-261 - production logs expose IP/secret metadata and stack details",
    "medium: frontend/src/routes/api/health/db/+server.ts:10-54 - unauthenticated database internals and raw errors",
    "medium: frontend/Dockerfile:2-39 - mutable images, full dev dependency tree, and broad writable app directory",
    "medium: frontend/src/hooks.server.ts:99-101 - unhandled rejection logs and continues serving"
  ],
  "manualNotes": "Review gate should reject production promotion until Critical/High dependency findings, CI-to-Railway promotion gating, and Railway backup/restore verification are resolved."
}
```
