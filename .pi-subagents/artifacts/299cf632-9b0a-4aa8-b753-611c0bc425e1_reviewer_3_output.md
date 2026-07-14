# Cold production-readiness verification — HEAD `b7b7aef1`

## Review

### Dependency advisory dispositions

- **Blocker — HIGH — TRUE POSITIVE package and sink; current remote content source is not attacker-reachable: `sanitize-html@2.17.3`.** The lock resolves exactly `2.17.3` (`frontend/bun.lock:999`), and it is a direct production dependency (`frontend/package.json:84`). GHSA-rpr9-rxv7-x643 marks exactly 2.17.3 Critical and fixed in 2.17.4. The application passes Markdown HTML through this sanitizer (`frontend/src/routes/blog/[slug]/+page.svelte:5-41`) and inserts the result with `{@html}` (`frontend/src/routes/blog/[slug]/+page.svelte:68,139`). A local reproduction using the application's exact allowlist produced live output: `<xmp><script>alert(1)</script></xmp>` → `<script>alert(1)</script>` and `<xmp><img src=x onerror=alert(1)></xmp>` → `<img src=x onerror=alert(1)>`. That proves the vulnerable behavior and browser sink. However, the current posts are compile-time source constants (`frontend/src/lib/blog/posts.ts:3-15`) selected by slug (`frontend/src/routes/blog/[slug]/+page.server.ts:1-14`); no user/CMS write path was found. Thus **the dependency/sink claim is TRUE, while unauthenticated stored-XSS exploitability at this HEAD is FALSE absent compromise of the trusted content/release path**. Upgrade remains a production gate because the sanitizer is demonstrably ineffective for this payload and CSP is absent.

- **Note — MEDIUM — FALSE POSITIVE for current production exploitability: `nodemailer@8.0.6`.** It resolves exactly at `frontend/bun.lock:903` and is direct (`frontend/package.json:81`). `bun audit` reports one High advisory (GHSA-p6gq-j5cr-w38f, `raw` bypass) and three Moderate advisories. The only application import is the legacy `smtp-service.ts` (`frontend/src/lib/services/smtp-service.ts:1-80`); repository-wide caller search found no import/use of `smtpService`. Active email uses `@sendgrid/mail` (`frontend/src/lib/email/providers/SendGridAdapter.ts:16,57-75,133-150`). Even the dormant service constructs a fixed object and never supplies `raw`, `jsonTransport`, attacker-controlled List comments, or OAuth token fetching. **Advisory code ships but the alleged High path is unreachable.** Remove the dead dependency or upgrade it; this is not independently a production blocker.

- **Note — MEDIUM — FALSE POSITIVE for the reported High exploit paths, but a reachable vulnerable runtime dependency: `axios@1.13.6`.** It resolves exactly at `frontend/bun.lock:571`, transitively from `@sendgrid/client@8.1.6` (`frontend/bun.lock:405`). Active mail delivery reaches SendGrid (`frontend/src/lib/email/providers/SendGridAdapter.ts:16,57-75,133-150`), so axios is production-executed, not dev-only. `bun audit` reports multiple High advisories affecting 1.13.6. The application does not call axios directly, does not accept request/proxy/redirect configuration from users, and builds a fixed SendGrid message/API call. No verified path supplies attacker-created prototype pollution into axios configuration, a hostile proxy redirect, or attacker-selected response/upload bounds. **Current exploitability of the listed High gadgets is FALSE on the traced path**, but upgrading `@sendgrid/*`/axios is prudent because the affected HTTP adapter processes a privileged API-key-bearing production request.

- **Note — LOW — FALSE POSITIVE for attacker-triggerable DoS: `devalue@5.7.1`.** It resolves exactly at `frontend/bun.lock:643`, from Svelte/SvelteKit/superforms (`frontend/bun.lock:425,1043,1055`). GHSA-77vg-94rm-hx3p affects 5.6.3–5.8.0 and is fixed in 5.8.1. SvelteKit uses it at runtime for framework-controlled serialization/deserialization, but application search found no direct devalue import and no `superValidate`/`__superform_json` use. The only potentially direct untrusted parser found is unused superforms package code. SvelteKit client `unflatten` consumes representations emitted by the server, not arbitrary request bodies. No source→sparse-array parser path was verified, so **the installed advisory is real but remote reachability is FALSE at this HEAD**. Upgrade through SvelteKit/Svelte anyway.

- **Note — dev advisories are nevertheless shipped.** High audit entries such as Vite's Windows dev-server path issue, Vitest/flatted, picomatch, and undici are principally tooling/dev paths and are not invoked by `bun run build/index.js`. They are still present in the production filesystem because all dependencies are copied (Docker finding below), increasing latent attack surface. `bun audit` also reports several Moderate/Low entries; this review's reachability conclusions are limited to the requested Critical/High set and named packages.

### CSP and browser-held cryptographic material

- **Blocker — HIGH — TRUE POSITIVE: absent CSP materially compounds any XSS.** The middleware sets frame, MIME, referrer, permissions and HSTS headers but no `Content-Security-Policy` (`frontend/src/hooks.server.ts:68-84`). The browser stores user-managed Shamir shares for 24 hours in readable `localStorage` (`frontend/src/lib/components/NewSecretForm.svelte:216-221`), stores Nostr `plaintextKs` in `localStorage` (`frontend/src/lib/components/NewSecretForm.svelte:260-274`), and stores Bitcoin private keys in readable `sessionStorage` (`frontend/src/lib/bitcoin/client-wallet.ts:34-46`) plus symmetric key K (`frontend/src/lib/bitcoin/client-wallet.ts:81-100`). Any same-origin JavaScript execution can read and exfiltrate these values. CSP is defense-in-depth rather than proof against every same-origin script gadget, but here it would directly restrict inline/event-handler payloads such as the verified sanitizer bypass and limit outbound exfiltration. Given the sensitivity and the live sanitizer/Svelte advisory surface, absence is materially consequential, not a cosmetic header omission.

### CI, deployment gating, and reproducibility

- **Blocker — HIGH — TRUE POSITIVE at repo level: production deployment is not demonstrably gated on CI.** CI itself has sensible ordering: build needs lint/typecheck and tests, and Docker needs build (`.github/workflows/ci.yml:19-80`). But the only workflow is CI; it neither deploys nor promotes a tested image. The committed Railway specification says a push to main makes Railway independently build and deploy (`openspec/changes/refactor-hosting-migration/specs/infrastructure/spec.md:5-13`). No repository control links Railway deploy to the successful GitHub run, and the authoritative infrastructure spec requires production approval (`openspec/specs/infrastructure/spec.md:162-169`). External GitHub branch-protection/Railway wait-for-CI settings were not available, so they cannot be credited. Disposition: **production blocker until external required-check/approval evidence is produced or deployment is explicitly CI-gated**.

- **Blocker — MEDIUM — TRUE POSITIVE: builds are lockfile-constrained but not reproducible.** `bun install --frozen-lockfile` is used in CI and Docker (`.github/workflows/ci.yml:30-31,49-50,66-67`; `frontend/Dockerfile:4-5`), which fixes JS package resolution. However CI selects `bun-version: latest` (`.github/workflows/ci.yml:26-28,45-47,62-64`), Docker bases are mutable `oven/bun:1`/`:1-slim` (`frontend/Dockerfile:2,8,15`), runners are `ubuntu-latest`, and actions are mutable major tags rather than commit SHAs. Railway then performs its own fresh build rather than promoting CI's tested digest. Exact source plus lockfile therefore does not identify an exact toolchain/base/image artifact.

### Production image contents

- **Blocker — MEDIUM — TRUE POSITIVE: the production image ships all dev dependencies.** The deps stage runs an unfiltered install (`frontend/Dockerfile:4-5`) and the runner copies that entire `node_modules` directory (`frontend/Dockerfile:23-26`). `package.json` places Vite/Svelte tooling, TypeScript, ESLint, jsdom and Vitest in devDependencies (`frontend/package.json:18-56`), while the resulting local install is 502 MB and includes `vitest`, `vite`, `typescript`, and `eslint`. This also carries their audit findings into the image. One nuance: startup executes `bunx drizzle-kit migrate` (`frontend/migrate-and-start.sh:14-23`), and `drizzle-kit` itself is currently a devDependency (`frontend/package.json:37`), so blindly pruning dev dependencies would break startup; migration tooling must be separated/copy-minimized deliberately.

### In-process cron, rolling deploys, and exports

- **Blocker — CRITICAL — TRUE POSITIVE: scheduled disclosure is not crash-safe.** Every server process starts the scheduler (`frontend/src/hooks.server.ts:92-104`); `CRON_ENABLED` defaults on and every replica registers every job (`frontend/src/lib/cron/scheduler.ts:109-128`). The `runningJobs` lock is only an in-memory `Set` (`frontend/src/lib/cron/scheduler.ts:9,85-104`) and offers no cross-replica exclusion. The important positive is that reminder workers atomically change `active`→`triggered`, so concurrent replicas cannot both claim the same secret (`frontend/src/lib/cron/process-reminders.ts:102-116`). But after that claim, a rolling termination/crash leaves status `triggered`; the scheduler query only fetches `active` records, and repository search found no stale-`processingStartedAt` recovery. A crash between claim and finalization can therefore permanently suppress the dead-man disclosure. This is a core availability/security invariant and a production blocker.

- **Blocker — HIGH — TRUE POSITIVE: export processing is unsafe across replicas and rolling deploys.** All replicas select the same `pending` rows (`frontend/src/lib/cron/process-exports.ts:30-35`), then each unconditionally updates by ID without `WHERE status='pending'`, transaction, row lock, or returned ownership token (`frontend/src/lib/cron/process-exports.ts:55-70`). Concurrent workers can generate duplicate exports and send duplicate ready emails (`frontend/src/lib/cron/process-exports.ts:83-100`). A crash after setting `processing` strands the job because future runs select only `pending`. Files are written to replica-local `/tmp` (`frontend/src/lib/gdpr/export-service.ts:168-183`; `frontend/Dockerfile:34-38`), so a later request routed to another replica—or any rollout/restart—cannot access them. More fundamentally, generated URLs target `/api/user/export-data/download?...` (`frontend/src/lib/gdpr/export-service.ts:182-183`), but the route tree contains only `+server.ts` and `[jobId]/+server.ts`; `[jobId]` merely returns that URL (`frontend/src/routes/api/user/export-data/[jobId]/+server.ts:48-70`). Thus the advertised download endpoint does not exist at this HEAD.

### Correct / mitigating evidence

- **Correct:** HEAD was verified as `b7b7aef1a897c418e0402acd211fecf0206d8217`; runner uses an unprivileged UID (`frontend/Dockerfile:19-21,37-39`), frozen lock installs are enabled, CI runs lint/typecheck/tests/build/Docker in dependency order, and the disclosure worker has a database-backed atomic claim for concurrent replicas.
- **Correct:** `bun run check` completed with 0 errors/0 warnings. `bun test` completed with 549 pass, 0 fail across 42 files. No audit-specific tests were added because this was read-only verification.
- **Note:** Requested `plan.md` does not exist. `progress.md` was read but describes an earlier Bitcoin demo/PR and does not substantiate these production claims.

## Verdict counts

- **TRUE POSITIVE / production-readiness blockers:** 7 findings (sanitize sink/package gate; CSP; deploy gating evidence; reproducibility; dev dependencies in image; cron crash safety; export concurrency/storage/routing).
- **FALSE POSITIVE for current exploitability:** 3 named advisory paths (nodemailer, axios gadget prerequisites, devalue sparse-array parser), with axios still directly production-executed and all three vulnerable versions shipped.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Performed a read-only cold verification at exact HEAD b7b7aef1 and wrote only the required audit artifact; no project/source files were modified."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Report includes exact lock versions, source-to-sink/reachability traces, PoC output, file:line citations, severity, TRUE/FALSE dispositions, test results, and residual external-verification limits."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/299cf632-9b0a-4aa8-b753-611c0bc425e1/audit-cold/infra-deps-fp.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git rev-parse HEAD; git status --short; git diff --cached --name-only",
      "result": "passed",
      "summary": "Verified exact HEAD b7b7aef1a897c418e0402acd211fecf0206d8217, no staged files; pre-existing untracked files remain."
    },
    {
      "command": "cd frontend && bun audit --json",
      "result": "failed",
      "summary": "Expected nonzero audit exit; confirmed Critical sanitize-html, High axios/devalue/nodemailer and additional advisories."
    },
    {
      "command": "cd frontend && bun pm ls --all | rg ...",
      "result": "passed",
      "summary": "Confirmed resolved dependency inventory including axios 1.13.6, devalue 5.7.1, nodemailer 8.0.6, sanitize-html 2.17.3 and dev-tool packages."
    },
    {
      "command": "cd frontend && bun -e <sanitize-html application-config PoC>",
      "result": "passed",
      "summary": "Confirmed xmp payload is transformed into live script/event-handler HTML under the exact application sanitizer configuration."
    },
    {
      "command": "cd frontend && bun run check",
      "result": "passed",
      "summary": "svelte-check found 0 errors and 0 warnings."
    },
    {
      "command": "cd frontend && bun test",
      "result": "passed",
      "summary": "549 tests passed, 0 failed, 1319 assertions across 42 files."
    }
  ],
  "validationOutput": [
    "sanitize-html PoC: xmp-wrapped script became <script>alert(1)</script>; xmp-wrapped img became <img src=x onerror=alert(1)>.",
    "bun audit resolved named versions exactly and returned advisories against each requested package.",
    "Docker inspection proves the runner copies the complete unfiltered dependency tree.",
    "Static call-path inspection distinguishes trusted blog constants, dormant nodemailer, active SendGrid/axios, framework-controlled devalue, and per-process cron locks."
  ],
  "residualRisks": [
    "GitHub branch protection and Railway deployment settings are external to the repository and were not available; production gating cannot be credited without evidence.",
    "No credentialed Railway rollout or multi-replica concurrency experiment was performed; cron/export conclusions follow directly from process-local locks, database predicates, and local filesystem semantics.",
    "Audit database content is time-sensitive as of 2026-07-10."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added only the required audit artifact; project/source diff remains unchanged.",
  "reviewFindings": [
    "blocker: frontend/src/lib/cron/process-reminders.ts:102-116 - crash after active-to-triggered claim can permanently suppress disclosure",
    "blocker: frontend/src/lib/cron/process-exports.ts:30-70 - exports lack an atomic distributed claim and crash recovery",
    "blocker: frontend/src/lib/gdpr/export-service.ts:168-183 - sensitive exports use ephemeral replica-local storage and a nonexistent download route",
    "blocker: frontend/src/hooks.server.ts:68-84 - no CSP despite script-readable shares and private keys",
    "blocker: frontend/Dockerfile:23-26 - production image copies all dev dependencies",
    "blocker: .github/workflows/ci.yml:19-80 - CI validates but does not gate/promote the independently built Railway deployment",
    "blocker: frontend/Dockerfile:2-15 and .github/workflows/ci.yml:26-28 - mutable toolchain/base tags prevent reproducible images"
  ],
  "manualNotes": "plan.md was absent. Existing untracked files were not altered or staged."
}
```
