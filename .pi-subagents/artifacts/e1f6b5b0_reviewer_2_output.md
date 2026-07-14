# KeyFate production-hardening review and implementation plan

## Review

- **Correct:** The image already uses three stages and a non-root UID/GID (`frontend/Dockerfile:1-42`), installs with `--frozen-lockfile` (`frontend/Dockerfile:5`), and fails startup after bounded migration retries (`frontend/migrate-and-start.sh:15-31`). These are useful foundations.
- **Correct:** Existing response hardening includes frame denial, MIME sniffing protection, referrer and permissions policies, HSTS in production, and HTTPS redirection (`frontend/src/hooks.server.ts:16-27,65-78`). The missing control is CSP.
- **Correct:** `/api/health` checks the database, required email configuration, and encryption-key shape, returns 503 when degraded, protects detailed data, and has direct handler tests for healthy/database-down/email-unconfigured/error cases (`frontend/src/routes/api/health/+server.ts:36-107`; `frontend/src/routes/api/health/__tests__/health.test.ts:88-181`).
- **Correct:** The blog converts Markdown, sanitizes it, and only then inserts it as HTML (`frontend/src/routes/blog/[slug]/+page.svelte:12-14,139`). Current posts are repository-controlled, so this is a bounded dependency upgrade rather than a content-model redesign.
- **Blocker:** There is no CSP in either SvelteKit configuration or the server hook (`frontend/svelte.config.js:5-15`; `frontend/src/hooks.server.ts:65-78`). This materially increases the consequence of browser injection because user-managed Shamir shares are retained in `localStorage` for 24 hours (`frontend/src/lib/components/NewSecretForm.svelte:216-220`) and Bitcoin private keypairs are stored in `sessionStorage` (`frontend/src/lib/bitcoin/client-wallet.ts:28-76`).
- **Blocker:** Every container start runs schema migration before serving (`frontend/Dockerfile:42`; `frontend/migrate-and-start.sh:12-34`). Restarts and horizontal replicas therefore couple process availability to DDL and can race. The runtime also needs `drizzle-kit` solely because startup calls `bunx drizzle-kit migrate`, while `drizzle-kit` is a dev dependency (`frontend/package.json:29`).
- **Blocker:** The runner copies the complete dependency tree from the development install (`frontend/Dockerfile:24`), so test, lint, typecheck, and build tooling ship in production. Base images use mutable major tags (`oven/bun:1`, `oven/bun:1-slim` at `frontend/Dockerfile:2,8,15`).
- **Blocker:** CI uses mutable action tags and `bun-version: latest` (`.github/workflows/ci.yml:24-28,43-47,60-64,77`). Although build/test jobs precede Docker build, repository code cannot establish GitHub required-check settings or Railway's deploy-after-CI behavior. The known audited-commit CI failure therefore remains a release gate, not merely a documentation issue.
- **Note:** The dependency manifest currently selects ranges, including `sanitize-html: ^2.17.3`, while the lock records 2.17.3 (`frontend/package.json:57`; `frontend/bun.lock:999`). Replace it with the exact remediated version named by the already-recorded finding; do not run another scanner.
- **Note:** Health semantics are conflated. There is no `/api/health/live` or `/api/health/ready`, despite the committed infrastructure specification requiring both (`openspec/specs/infrastructure/spec.md`, “Readiness vs liveness”). An application process can be alive while `/api/health` returns 503 because email configuration or the database is unavailable.
- **Note:** Railway evidence is stale/incomplete. The active hosting migration still leaves cron execution, backups, full smoke testing, DNS/OAuth/webhook updates, and production E2E unchecked (`openspec/changes/refactor-hosting-migration/tasks.md:24-30,62-79`). `docs/plans/migration-testing-checklist.md:77-82` describes paid-plan snapshots but contains no restore-drill evidence.
- **Note:** The requested `plan.md` does not exist. `progress.md` is an unrelated issue-6 timelock status and explicitly records that `plan.md` was absent. It should not be treated as production-hardening evidence.

## Ordered, minimally disruptive implementation plan

### 0. Freeze scope and establish the failing baseline

1. Create an OpenSpec change such as `harden-production-delivery` because CSP, release gating, migration lifecycle, and probe semantics are cross-cutting production behavior. Add deltas only to `http-security`/`infrastructure`; do not add vulnerability discovery work.
2. Record the exact audited commit and its failing GitHub job/log URL. Run only existing quality commands and targeted tests listed below. Do **not** run dependency/security scanners.
3. Make each following tranche independently reviewable and require green CI before moving to Railway configuration.

### 1. Reproducibility and the already-flagged sanitizer update

Files:

- `frontend/package.json`
- `frontend/bun.lock`
- `.github/workflows/ci.yml`
- `frontend/Dockerfile`
- targeted blog test under `frontend/src/routes/blog/[slug]/` (new)

Implementation:

1. Change `sanitize-html` from a range to the **exact fixed version specified by the existing finding**, regenerate `frontend/bun.lock` with the repository's Bun version, and verify the existing allowlist at the sole blog sink. Do not broaden allowed tags/attributes or change trusted-content ownership.
2. Add a focused regression test around exported Markdown/sanitization logic: permitted post markup survives; scripts, event-handler attributes, and dangerous URL schemes do not reach `htmlContent`. Extract the formatter to a small adjacent module only if needed for testing.
3. Choose one exact Bun release that passes locally and CI. Pin that same release in:
   - `oven/bun:<exact>@sha256:<digest>` and its slim equivalent in all Docker stages;
   - `oven-sh/setup-bun`'s `bun-version` input.
   Record the version/digests in a Docker comment or operations document and update them deliberately with lockfile PRs.
4. Pin `actions/checkout` and `oven-sh/setup-bun` by full commit SHA, retaining a version comment (for example, `# v4`) for maintainability. Action SHAs, not mutable tags, are the reproducibility boundary.
5. Keep `bun install --frozen-lockfile`; add a CI assertion/build that fails if lockfile and manifest disagree.

### 2. Add an enforced CSP compatible with current browser flows

Files:

- `frontend/svelte.config.js`
- `frontend/src/hooks.server.ts` (only if a per-request/report-only rollout helper is required)
- `frontend/src/routes/blog/[slug]/+page.svelte`
- `frontend/src/lib/components/Turnstile.svelte` (only if nonce/API compatibility requires it)
- `frontend/src/lib/nostr/relay-config.ts` or CSP config module (single source for fixed origins if practical)
- new `frontend/src/lib/__tests__/security-headers.test.ts`
- browser smoke test for sign-in/Turnstile, blog, secret creation/export, Nostr, and Bitcoin flows

Compatibility strategy:

1. Prefer SvelteKit's native `kit.csp` support with nonce/auto handling rather than manually generating a CSP string. Begin with a short report-only staging observation only to discover compatibility violations, then ship enforcing mode in the same tranche; report-only alone does not resolve the blocker.
2. Start from `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' <SvelteKit nonce>; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; worker-src 'self' blob:; manifest-src 'self'`.
3. Add only demonstrated browser connections:
   - Cloudflare Turnstile script/frame origin (`https://challenges.cloudflare.com`);
   - `https://mempool.space` and `https://blockstream.info` if browser-side Bitcoin calls exercise them;
   - `wss:` for the currently configurable Nostr relay model. Document that broad WebSocket allowance is a compatibility trade-off; a later product decision could constrain custom relays, but that is outside this fix.
   Avoid `unsafe-eval`; do not add wildcard script origins.
4. Make the JSON-LD script at `frontend/src/routes/blog/[slug]/+page.svelte:79` nonce-compatible using normal Svelte/SvelteKit head rendering instead of constructing a raw `<script>` through `{@html}`. Keep sanitized article HTML at line 139.
5. Keep the existing defense headers. CSP `frame-ancestors 'none'` intentionally duplicates `X-Frame-Options: DENY` for older clients.
6. Test the exact production header, asserting required directives and absence of `unsafe-eval`; run a production-mode browser suite that proves Turnstile loads, the blog renders, secret shares can be created/exported, Web Storage behavior remains unchanged, and Nostr/Bitcoin network operations are not CSP-blocked. Inspect browser console CSP violations in this bounded suite.

### 3. Separate migrations from application startup and slim the image

Files:

- `frontend/Dockerfile`
- `frontend/migrate-and-start.sh` (remove after Railway migration command is proven, or reduce to app-only execution temporarily)
- new `frontend/scripts/migrate.ts` (or equivalent dedicated migration entrypoint)
- `frontend/package.json`
- `frontend/.dockerignore`
- migration unit/integration test and Docker smoke script/workflow
- `openspec/changes/refactor-hosting-migration/tasks.md` and infrastructure delta/design

Implementation:

1. Add a dedicated migration entrypoint using runtime `drizzle-orm/postgres-js/migrator` plus `postgres`, pointing at the generated `./drizzle` folder copied into the image. It MUST require `DATABASE_URL` (no localhost production fallback), close its single connection, and exit nonzero on failure. Do not use the stale `frontend/src/lib/db/migrate.ts`, which points at `./src/lib/db/migrations` and uses CommonJS `require.main` in an ESM package.
2. Configure Railway's **pre-deploy command** to run that entrypoint exactly once per deployment. Change container `CMD` to `bun run build/index.js` only. This removes migration from ordinary restarts and replica starts. Keep migrations forward-compatible with old app code; destructive changes require expand/contract deployments.
3. Add a `prod-deps` stage using `bun install --frozen-lockfile --production`. Audit package classification by runtime import/build smoke—not by a new vulnerability scan. Move build-only items (notably Vite and UI/build tooling) to `devDependencies`; keep server runtime imports in `dependencies`. The runner copies only production `node_modules`, `build/`, migration entrypoint, and `drizzle/`.
4. Ensure `bunx` cannot fetch anything at runtime. The migration entrypoint must use installed runtime libraries directly.
5. Add `HEALTHCHECK` only if Railway honors image health checks consistently; otherwise configure Railway's health-check path externally as `/api/health/ready`. Do not maintain two competing probe authorities.
6. CI Docker test on Linux: build pinned image, assert it runs as UID 1001, assert representative dev packages/binaries are absent, start it against ephemeral PostgreSQL after running the migration command separately, poll readiness, make one HTTP request, stop it, and verify restart does not invoke migrations. Capture image size before/after as evidence, not as a pass threshold.
7. Migration integration test: fresh database migrates; second invocation is idempotent; deliberately invalid `DATABASE_URL` fails closed; app startup is not attempted on migration failure. A staging pre-deploy followed by schema/application smoke test is mandatory before production.

### 4. Make probe semantics explicit

Files:

- new `frontend/src/routes/api/health/live/+server.ts`
- new `frontend/src/routes/api/health/ready/+server.ts`
- `frontend/src/routes/api/health/+server.ts`
- new/updated tests under those route directories
- `docs/plans/migration-testing-checklist.md`
- relevant OpenSpec infrastructure delta

Implementation:

1. `/api/health/live`: process-only, no database or external calls, minimal 200 response.
2. `/api/health/ready`: bounded database check plus required local configuration/key validation; return 503 on failure. Keep external SendGrid/Stripe/BTCPay network calls out of probes. Whether email **configuration** is readiness-critical should remain consistent with the current endpoint (yes) unless an explicit product decision changes it.
3. Preserve `/api/health` as a compatibility alias to readiness and preserve authenticated `?detailed=true` behavior, avoiding a breaking operations change.
4. Add time bounds for database readiness per the infrastructure spec. Test live during DB failure, ready healthy/unhealthy/timeout, malformed encryption key, missing email configuration, redaction, and detailed authorization.

### 5. Turn CI into a demonstrable deploy gate

Files/configuration:

- `.github/workflows/ci.yml`
- optionally `.github/workflows/deploy.yml` only if Railway cannot wait for GitHub checks
- GitHub branch rules (external)
- Railway service/environment settings (external)
- `docs/plans/migration-testing-checklist.md`

Implementation:

1. Keep quality gates ordered: frozen install → format/lint → Svelte check → full tests → production build → Docker/migration/runtime smoke. Use explicit job names stable enough for branch protection. Add `concurrency` cancellation for superseded PR/push runs and least-privilege `permissions: contents: read`.
2. Require all jobs on `main` in GitHub branch protection; disallow direct pushes/bypass for normal maintainers and require the reviewed PR head to be current.
3. Minimal Railway choice: enable its GitHub **Wait for CI** behavior, map staging/production to their intended protected branches, and disable deploy-on-failed-check. If that setting cannot provide auditable ordering, disable automatic Railway GitHub deploys and add a post-CI deployment job pinned to an immutable deployment mechanism; store token/environment approvals in GitHub Environments. Do not claim gating until one option is exercised.
4. Prove fail closed: push a harmless branch commit with an intentionally failing test/check and show no Railway deployment was created; then restore it, show all required checks pass, show the exact SHA deployed to staging, approve production, and show that same SHA deployed. Save URLs/timestamps/screenshots or API output.

### 6. External Railway/credentialed acceptance gates

These cannot be completed or proven by repository changes alone:

1. Railway: pinned Docker build succeeds; pre-deploy migration command is configured; readiness path and timeout are configured; `Wait for CI`/deployment source mapping is verified; staging and production environment variables are complete; deployment reports the expected Git SHA.
2. GitHub: required checks and environment approval rules are active and bypass behavior is tested.
3. Runtime: Linux container smoke, non-root identity, production-only dependency contents, graceful restart, migration failure behavior, and readiness transitions are captured from CI/Railway. Local Docker was unavailable during this review, so none may be claimed yet.
4. Staging credentialed E2E: Google OAuth callback, Turnstile, secret create/check-in/export/recovery, SendGrid delivery, Stripe webhook/payment, all scheduled jobs, Nostr relay publication/recovery, and Bitcoin testnet calls under enforcing CSP.
5. Production: DNS/TLS/custom domain, OAuth and Stripe production URLs, smoke journey, scheduler logs, alert routing, and rollback drill.
6. Database operations: enable Railway backups/PITR, record retention actually purchased, restore a backup into an isolated environment, verify integrity, measure RPO/RTO, and document restore/rollback ownership. The checked-in spec's old Cloud SQL 30/90-day language must be reconciled with the Railway plan rather than claimed.
7. Only after Railway production and restore evidence is accepted should remaining GCP resources be torn down, consistent with `docs/plans/migration-testing-checklist.md:84-157`.

## Required validation sequence

```text
cd frontend && bun install --frozen-lockfile
cd frontend && bun run lint
cd frontend && bun run check
cd frontend && bun run test
cd frontend && bun run build
cd frontend && bun test <targeted sanitizer/header/health/migration tests>
docker build --pull=false -t keyfate:<git-sha> frontend
<ephemeral-postgres + dedicated migration + image readiness/restart smoke>
openspec validate harden-production-delivery --strict
```

Do not run `bun audit`, third-party scanners, ZAP, or any new vulnerability search. The sanitizer version verification is remediation of the existing finding, not a new scan.