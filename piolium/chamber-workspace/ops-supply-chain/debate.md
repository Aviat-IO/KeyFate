# Review Chamber — scheduler, exports, browser and supply chain

Status: CLOSED

## Round 1 — Attack Ideator

Hypotheses: replica-local cron causes duplicate/missing disclosure; export jobs race/strand; vulnerable sanitizer enables XSS; browser storage amplifies script execution; CI/release can deploy failing mutable builds; dependency advisories are reachable.

## Round 2 — Code Tracer

- Every replica starts cron; in-memory running set is process-local. Disclosure has atomic `active`→`triggered` claim but no stale-triggered recovery. Crash after claim permanently suppresses processing. REACHABLE normal fault.
- Export selects pending rows without atomic ownership, writes local `/tmp`, can strand processing, and generates a missing download route. REACHABLE blocker.
- `sanitize-html@2.17.3` feeds `{@html}` and exact XMP bypass reproduces. Current source is trusted compile-time blog constants. PARTIAL, no remote authoring.
- User shares/Nostr K are in localStorage; Bitcoin private keys/K in sessionStorage. No CSP exists. REACHABLE impact amplifier for same-origin script execution.
- CI uses mutable versions and is not connected in repository to Railway promotion. Audited and recent main runs are red. REACHABLE release governance gap.
- Bun audit advisories were traced; Nodemailer/devalue/most Axios high gadgets lacked attacker-controlled runtime paths.

## Round 3 — Devil's Advocate

- Atomic disclosure claim prevents duplicates but strengthens the crash-stranding evidence; there is no recovery state.
- Generated IDs defeat path traversal alerts but not export durability/route defects.
- Trusted blog content prevents current unauthenticated XSS; sanitizer/CSP chain is a production gate, not a remote finding.
- Non-root image and frozen lockfile are positive controls, but all dev dependencies ship and runtime/base/action versions remain mutable.
- External Railway/branch protection could exist, but was unavailable and cannot be credited.

## Round 4 — Chamber Synthesizer

- CRITICAL production blocker: crash-stranded disclosure.
- HIGH production blocker: export ownership/storage/download.
- HIGH production gate: vulnerable sanitizer plus absent CSP around browser-held keys; not counted as current remote XSS.
- HIGH production blocker: red CI and no demonstrated release gate.
- MEDIUM production blockers: mutable build provenance and unfiltered runtime dependencies.
- Dependency alerts without reachable attacker inputs were downgraded.

Cold infrastructure/dependency review independently confirmed these results.
