# KeyFate security and production-readiness audit

Audit ID: `2026-07-10T23:21:09Z`  
Commit: `b7b7aef1a897c418e0402acd211fecf0206d8217`  
Repository: `Aviat-IO/KeyFate`  
Date completed: 2026-07-11

## Executive Summary

**Release verdict: DO NOT RELEASE the audited commit to production.**

The audit confirmed **1 High and 7 Medium security findings**, plus independent production blockers in the disclosure scheduler, Nostr and Bitcoin recovery, export processing, dependencies/browser defenses, payment handling, and CI/release controls.

The most serious issue is the dead-man disclosure state machine: after atomically changing a secret from `active` to `triggered`, a crash or rolling termination can leave it permanently outside future scheduler queries. This can suppress the product's core disclosure action. Under the stated Railway rolling/multi-replica assumption, this is a Critical release blocker.

The cryptographic architecture also violates its documented zero-knowledge boundary. During normal 2 of 3 Nostr-enabled creation, the application receives one server share and a second user-managed share before publishing it, which reaches the reconstruction threshold inside the server trust domain. A real local reconstruction using the shipped Shamir library succeeded.

Both launch-required recovery channels are blocked: the Nostr publisher's payload is incompatible with the recovery UI, and Bitcoin setup is explicitly disabled while its recipient-key custody would strand funds if simply enabled.

## Methodology Summary

The review covered the canonical tracked repository at the stated commit. `.worktrees`, dependency directories, generated/build output, and vendor code were excluded from source review. Application source was not modified; all generated artifacts are under `piolium/` or the pre-existing `.pi-subagents/` audit area.

Methods:

- architecture and trust-boundary reconstruction;
- threat modeling and abuse-path enumeration;
- manual review of auth, tenant boundaries, crypto custody, Nostr/Bitcoin, billing, scheduler, exports, CI, Docker, and dependencies;
- clean CodeQL JavaScript database and full installed security-and-quality suite;
- Semgrep OSS standard, Trail of Bits, and custom KeyFate rules;
- Bun production/full dependency audits;
- Gitleaks HEAD and history scans;
- independent cold false-positive review;
- local executable probes for the highest-value claims;
- build, typecheck, test, lint, and Drizzle schema validation.

Architecture, DFD/CFD, advisory, SAST, coverage, and specification analysis is in [`attack-surface/knowledge-base-report.md`](attack-surface/knowledge-base-report.md).

## Summary of Findings

| ID  | Severity | Finding                                                                                              | Validation                                                                   | Report                                                             |
| --- | -------: | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| H1  |     High | Server receives enough plaintext shares to reach the default 2 of 3 threshold                        | source trace + real library reconstruction                                   | [`report`](findings/H1-server-reaches-shamir-threshold/report.md)  |
| M1  |   Medium | Any authenticated tenant can invoke the global application-key decrypt primitive on arbitrary tuples | executable local route harness                                               | [`report`](findings/M1-global-decryption-oracle/report.md)         |
| M2  |   Medium | NIP-59 recovery omits seal/rumor/trusted-author and recipient binding                                | executable invalid-seal PoC + source trace                                   | [`report`](findings/M2-nip59-unverified-recovery-events/report.md) |
| M3  |   Medium | Anonymous invalid OTP submissions can lock an arbitrary email account                                | cold-verified state trace                                                    | [`report`](findings/M3-otp-lockout-dos/report.md)                  |
| M4  |   Medium | Authenticated top-level cross-site GETs create Stripe/BTCPay objects                                 | cold-verified source-to-provider trace                                       | [`report`](findings/M4-state-changing-checkout-get/report.md)      |
| M5  |   Medium | Security rate limits are non-atomic and fail open                                                    | deterministic lost-update trace                                              | [`report`](findings/M5-rate-limit-race/report.md)                  |
| M6  |   Medium | Stripe accepts any active recurring lookup key and may grant Pro without approved-price validation   | independent payment-path review; live exploitability configuration-dependent | [`report`](findings/M6-stripe-price-allowlist-bypass/report.md)    |
| M7  |   Medium | Plaintext database bearer tokens unlock plaintext server shares through an unauthenticated route     | direct DB-token-to-decrypt trace                                             | [`report`](findings/M7-db-token-unlocks-server-share/report.md)    |

### H1 — application trust domain reaches the Shamir threshold

The browser sends `shares[0]` to the secret-creation route. When Nostr is enabled, it then sends a different user-managed share to the server publisher, which encrypts it only after receipt. In the standard 2 of 3 configuration, the application process can reconstruct the original secret. This directly conflicts with the documented statement that the service cannot see, process, or decrypt plaintext.

### M1/M7 — encryption-at-rest separation is bypassable

The global decrypt route is tenant-agnostic and purpose-agnostic. M7 is a second path: a read-only database attacker can take an unexpired plaintext check-in token and call the unauthenticated server-share endpoint, which decrypts and returns the share. Both paths expose one factor rather than a complete normal-threshold secret, which is why they are Medium rather than High.

### M2 — confidentiality without authenticity

The normal `SimplePool` path filters invalid outer signatures, but a malicious Nostr author can create a valid attacker-signed outer event. The recovery code does not validate the seal, rumor, author consistency, trusted KeyFate publisher, recipient tag, or schema. The executed PoC also proved the exported unwrap function accepts an invalid seal signature.

### M3–M6 — web/business logic

These findings require no memory corruption or injection. They arise from durable account state, unsafe HTTP method semantics, lost-update concurrency, and entitlement not being bound to canonical provider pricing.

## Production-readiness blockers

| Priority | Severity | Blocker                                                                             | Evidence / consequence                                                                                                                                                                                                         |
| -------- | -------: | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B0       | Critical | Disclosure is not crash-safe                                                        | a crash after `active`→`triggered` permanently suppresses future processing; no stale lease/recovery found                                                                                                                     |
| B1       |     High | Nostr recovery cannot consume production publisher payloads                         | publisher places `{encryptedShare, nonce, encryptedKNostr}` JSON in `share`; UI treats the JSON string as ciphertext hex and never uses `encryptedKNostr`                                                                      |
| B2       |     High | Bitcoin recovery is disabled and unsafe to enable                                   | all-zero placeholder forces early return; recipient key exists only in owner's session storage and is never transferred; output would be unspendable by the actual recipient                                                   |
| B3       |     High | Zero-knowledge contract is false in the default Nostr path                          | same root cause as H1; launch claim/invariant violation                                                                                                                                                                        |
| B4       |     High | Export workflow is broken across replicas and even on one replica                   | no atomic claim/recovery; files use replica-local `/tmp`; generated download route does not exist                                                                                                                              |
| B5       |     High | CI is red and production release is not demonstrably gated                          | audited CI run failed lint/tests and skipped build/Docker; latest three listed main runs failed; no repository promotion workflow or external gate evidence                                                                    |
| B6       |     High | Vulnerable sanitizer plus absent CSP protects browser-held recovery material poorly | critical `sanitize-html` bypass reproduced at an `{@html}` sink; no current remote authoring path, but shares/K/private keys are script-readable and no CSP limits execution/exfiltration                                      |
| B7       |   Medium | BTCPay subscription integration is broken and contains latent currency confusion    | official invoice webhook metadata is top-level, but adapter forwards `raw.data`; handler therefore misses metadata. Checkout also interprets 9/90 in attacker-selected currency and settlement never validates amount/currency |
| B8       |   Medium | Dependency and image attack surface is excessive                                    | production audit: 46 advisories; all dev dependencies copied into runtime image                                                                                                                                                |
| B9       |   Medium | Builds are not reproducible/promoted artifacts                                      | `bun-version: latest`, mutable action/base tags and runner; Railway independently rebuilds rather than promoting a tested digest                                                                                               |
| B10      |   Medium | Release validation is incomplete                                                    | local Docker runtime unavailable; no credentialed Railway, database, Stripe, BTCPay, Nostr, Bitcoin, backup/restore, monitoring, or SLA exercise                                                                               |

### B0 — scheduler failure mode

Every app replica starts every cron job. The replica-local `runningJobs` set does not coordinate replicas. The disclosure worker has a useful atomic claim, preventing duplicate claims, but that same transition creates a terminal failure mode: after the record becomes `triggered`, later runs select only `active`. No durable lease, processing timestamp recovery, or reconciliation path was found. A normal rolling deploy is sufficient to trigger the failure window.

### B1/B2 — launch-required recovery channels

Per user direction, Nostr and Bitcoin recovery are required for launch. Both fail their functional gate at this commit, independently of the security findings.

Nostr's production envelope and recovery UI disagree. Tests cover simplified direct-hex fixtures rather than a real publisher→relay→unwrap→UI round trip.

Bitcoin is intentionally stopped by an all-zero placeholder guard. Removing it would not be a fix: refresh keys are session-only, the recipient output is controlled by an undistributed browser-generated key, server status omits the stored pre-signed transaction expected by export, and broadcast/persistence ordering has loss windows.

### B4 — export lifecycle

All replicas can select the same pending row. Updates do not condition on pending ownership, and a crash after setting processing strands the job. A generated archive lives in local `/tmp`; a rollout or request to another replica loses it. The emailed URL targets `/api/user/export-data/download`, but no such route exists.

### B6 — dependency/scripting chain

The audit reproduced GHSA-rpr9-rxv7-x643 using KeyFate's exact allowlist:

- `<xmp><script>…</script></xmp>` became a live `<script>` element;
- `<xmp><img … onerror=…></xmp>` retained the event handler.

Current blog posts are trusted compile-time constants, so this is not counted as an unauthenticated XSS finding. It remains a production gate because the vulnerable primitive reaches `{@html}`, CSP is absent, and sensitive shares/keys are stored where any same-origin JavaScript can read them. Evidence: [`findings/supporting/sanitize-html-advisory/report.md`](findings/supporting/sanitize-html-advisory/report.md).

## Static analysis summary

### CodeQL

- 252/252 selected production JS/TS files extracted.
- Official security-and-quality suite: 45 results across 13 rules; 26 security-tagged.
- Custom structural results: 9 recognized remote sources, 3 filesystem sinks, four URL-token sources, two browser-storage families, one confirmed generic-decrypt call.
- 198 Svelte files and framework-specific SvelteKit/Drizzle/Nostr semantics were not modeled and required manual review.
- Community JavaScript pack was unavailable due GHCR 403.

Promoted CodeQL/custom-query signal is included in H1/M1/M7 and the browser-storage production blocker. Three official path-injection results were false positives for attacker-controlled traversal because IDs/filenames are generated, though the export feature is broken for different reasons.

### Semgrep

- Semgrep Pro unavailable; user approved full OSS fallback.
- Standard OSS security rules, Trail of Bits rules, and custom KeyFate rules executed.
- 13 merged SARIF results.
- Findings were manually validated; tool output alone was not promoted.

Artifacts:

- [`codeql-artifacts/flow-paths-all-severities.md`](codeql-artifacts/flow-paths-all-severities.md)
- [`codeql-artifacts/entry-points.json`](codeql-artifacts/entry-points.json)
- [`codeql-artifacts/sinks.json`](codeql-artifacts/sinks.json)
- [`codeql-artifacts/call-graph-slices.json`](codeql-artifacts/call-graph-slices.json)
- [`semgrep-results/results/results.sarif`](semgrep-results/results/results.sarif)

## Supply-chain and secret-scan results

### Dependency audit

- Full graph: 57 advisories — 1 critical, 20 high, 31 moderate, 5 low.
- Production mode: 46 advisories — 1 critical, 15 high, 27 moderate, 3 low.
- Critical sanitizer is a real installed vulnerable package at a real sink, but current remote content reachability is absent.
- Nodemailer high path is in a dormant legacy service.
- Axios is production-reached through SendGrid, but the app does not expose the advisory's attacker-controlled config/proxy inputs.
- Devalue sparse-array DoS was not reachable through an application parser at this commit.

### Secret scan

- Two HEAD detections were test/agent-document placeholders; no live secret confirmed.
- Historical scan produced 81 candidates. No confirmed active credential was established, but external provider/key rotation state cannot be proven from repository history alone.

## Rejected or downgraded claims

- **Generic CSRF on JSON unsafe methods:** rejected. SvelteKit production origin checks and cookie behavior block the proposed cross-site form path. State-changing GETs remain valid because those controls do not protect safe-method navigation.
- **XFF spoofing:** not assumed without Railway header-normalization evidence. The rate-limit race/fail-open behavior is independently valid.
- **Export path traversal:** CodeQL signal rejected because path segments are generated identities/service filenames. Export correctness blockers remain.
- **Current unauthenticated blog XSS:** rejected because content is source-controlled at HEAD. The vulnerable sanitizer/sink remains a production gate.
- **Nostr outer-signature bypass in normal relay query:** narrowed because `SimplePool` verifies outer events. Seal/trusted-author/rumor binding remains missing.
- **Complete plaintext from M1/M7 alone:** not claimed; normal threshold reconstruction still needs another share.

## Positive controls observed

- Authenticated route group redirects users without sessions.
- Drizzle parameterization prevents the reviewed SQL-injection claims.
- Stripe and BTCPay webhook signatures use provider HMAC/signature validation; timing-safe comparison is used for BTCPay.
- Disclosure worker uses a conditional database claim, preventing two replicas from claiming the same active secret simultaneously.
- Container runtime uses an unprivileged UID.
- HTTPS redirect, HSTS, frame, MIME, referrer, and permissions headers are set.
- Frozen Bun lockfile is used in CI and Docker.
- AES-GCM and ChaCha20-Poly1305 primitives are from established libraries; no primitive break was alleged.

## Validation results

| Check                       | Result                                             |
| --------------------------- | -------------------------------------------------- |
| `bun run check`             | PASS — 0 errors, 0 warnings                        |
| `bun test`                  | PASS — 549 tests                                   |
| `bun run build`             | PASS                                               |
| `bun run lint`              | FAIL — Prettier reported 18 files                  |
| `drizzle-kit check`         | PASS with placeholder non-secret `DATABASE_URL`    |
| Docker build/runtime        | BLOCKED — local Docker API unavailable             |
| GitHub CI at audited commit | FAIL — lint and tests failed; build/Docker skipped |

## PoC and evidence index

| Claim                                                                  | Status                                                      | Evidence                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Shamir threshold reached by two server-observed roles                  | local cryptographic proof; production capture not performed | [`H1 evidence`](findings/H1-server-reaches-shamir-threshold/evidence/shamir-reconstruction.log)    |
| Global decrypt oracle                                                  | executed local route harness                                | [`M1 evidence`](findings/M1-global-decryption-oracle/evidence/decrypt-oracle-poc.log)              |
| Invalid NIP-59 seal accepted                                           | executed local production-library flow                      | [`M2 evidence`](findings/M2-nip59-unverified-recovery-events/evidence/nip59-poc.log)               |
| Sanitizer XMP bypass                                                   | executed with exact app allowlist                           | [`supporting evidence`](findings/supporting/sanitize-html-advisory/evidence/sanitize-html-poc.log) |
| OTP lockout / GET side effects / rate race / DB token / Stripe catalog | theoretical or blocked, with explicit prerequisites         | finding `poc.md` files                                                                             |

No production secret, account, payment, relay event, or Bitcoin transaction was accessed or created.

## Remediation candidate status (2026-07-11)

The findings above describe audited commit `b7b7aef1a897c418e0402acd211fecf0206d8217`. The current uncommitted remediation candidate removes or fences the confirmed H1 and M1–M7 paths, but it is not a credentialed production validation of those changes.

Local candidate evidence:

| Check                          | Result                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                 | PASS using the count-based ESLint baseline captured at the audited commit; new violations fail                                                    |
| `bun run check`                | PASS — 0 errors, 0 warnings                                                                                                                       |
| default `bun test`             | PASS — 581 passed, 5 explicit PostgreSQL skips, 0 failed, 1,371 expectations across 66 files                                                      |
| PostgreSQL integration         | PASS — 5 tests and 34 expectations for parent/recipient and export fencing, OTP, `0008` upgrade, legacy-row convergence, and mixed-version writes |
| `bun run build`                | PASS                                                                                                                                              |
| `drizzle-kit check`            | PASS                                                                                                                                              |
| migrations/retry/local restore | PASS — 11 journal entries; retry remains at 11; isolated logical restore retained all entries and required recovery/export columns                |
| Piolium phase 15 validator     | PASS                                                                                                                                              |
| Docker image                   | PASS — `sha256:24ccc60c9f454482da6788eb0a6f5ae911d00517da119beb7f107605b269165e` (`uncommitted-remediation-candidate`)                            |
| Docker runtime                 | PASS — UID 1001, app-only CMD, liveness 200, fail-closed readiness 503 without DB, and readiness 200 with `pg_stat_ssl`-confirmed TLS             |

The image excludes Vite, adapter-node, the Svelte Vite plugin, TypeScript, ESLint, Prettier, Drizzle Kit, and Vitest while retaining the runtime SvelteKit, Svelte, Drizzle ORM, and PostgreSQL packages. Bitcoin enrollment remains disabled by default: the primitives and recipient recovery path are tested, but the production owner setup/continuity/refresh workflow is not yet wired. Railway/provider, live-relay, Railway backup/PITR, and funded signet gates remain unobserved, so the release verdict remains **NO-GO**.

## Required release gates

The audited commit should remain unreleased until evidence shows, at minimum:

1. crash/restart/rolling-deploy recovery fences application state, resumes per recipient, and has an approved mitigation for possible provider-accepted duplicates;
2. the application trust domain never receives a Shamir threshold set;
3. a real Nostr publisher→relay→recovery round trip succeeds and authenticates/binds every envelope layer;
4. Bitcoin recipient custody, transaction delivery, refresh, and recovery succeed without session-only owner keys;
5. export jobs have durable ownership/storage/download and crash recovery;
6. approved server-side price/amount/currency is validated before entitlement for Stripe and BTCPay;
7. security findings H1 and M1–M7 are closed or explicitly risk-accepted by accountable owners;
8. critical/high reachable dependencies and CSP/browser-key exposure are resolved;
9. main CI is green, immutable release provenance exists, and Railway cannot deploy an unapproved failing revision;
10. credentialed staging exercises provider webhooks, scheduler failure injection, backup/restore, monitoring, rollback, and database migrations.

## Conclusion

The audited revision does not satisfy KeyFate's stated zero-knowledge, recovery, durable-disclosure, billing, or release-safety invariants. The confirmed findings and release blockers are reachable in the documented threat/deployment model and are sufficient to reject production release independently of tooling or live-environment limitations. The strongest existing controls—authenticated route groups, parameterized ORM access, provider signature checks, non-root execution, and an atomic initial disclosure claim—do not close the identified custody and crash-recovery gaps.

Supporting test and variant records:

- [`findings/supporting/penetration-test-report.md`](findings/supporting/penetration-test-report.md)
- [`findings/supporting/variant-analysis-report.md`](findings/supporting/variant-analysis-report.md)

## Limitations

- Semgrep Pro and the CodeQL community pack were unavailable.
- Trivy, Syft, OSV-Scanner, and Grype were not installed.
- The Docker daemon was unavailable during collection against the audited target; the later uncommitted remediation candidate received local Docker/PostgreSQL validation recorded above.
- No credentialed Railway, Stripe, BTCPay, live Nostr relay, or funded Bitcoin environment was available.
- External branch protection, Railway deployment controls, secrets, backup/restore, monitoring, SLA, and key-rotation evidence were not available.

These limitations reduce assurance; they do not weaken the confirmed blockers.
