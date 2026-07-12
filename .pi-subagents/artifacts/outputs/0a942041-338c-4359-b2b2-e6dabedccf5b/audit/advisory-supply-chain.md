# Research: KeyFate dependency and advisory intelligence (HEAD `b7b7aef1`)

## Summary
The lockfile resolves four production-path packages with current reviewed advisories: `sanitize-html@2.17.3`, `nodemailer@8.0.6`, and transitive `axios@1.13.6`; the latter two each have multiple 2026 advisories. `marked@18.0.2` is **not** affected by GHSA-6v9c-7cg6-27q7 (it is the patched release). Independent supply-chain weaknesses are pervasive mutable references: Bun base images, Compose service images, GitHub Actions tags, and `bun-version: latest`.

## Findings

1. **High — `sanitize-html@2.17.3` is vulnerable to default sanitizer bypass / stored XSS (CVE-2026-44990, GHSA-rpr9-rxv7-x643).** Affected `<=2.17.3`; patched `2.17.4`. It is a direct runtime dependency and the vulnerable version is exactly resolved. The default discard handling of attacker-controlled content inside a disallowed `xmp` element can expose active HTML/JavaScript when sanitized output is rendered. Production reachability is **plausible/high**, but whether KeyFate accepts and later renders attacker-controlled HTML was not established in this dependency-only review. **Confidence: high (version/advisory), medium (reachability).** [GitHub reviewed advisory](https://github.com/advisories/ghsa-rpr9-rxv7-x643) · [upstream advisory](https://github.com/apostrophecms/apostrophe/security/advisories/GHSA-rpr9-rxv7-x643)

2. **High aggregate — `axios@1.13.6`, pulled by `@sendgrid/client@8.1.6`, is below the current safe line.** The exact transitive version is in `bun.lock` and production dependencies are copied wholesale into the runner image. Key reviewed advisories affecting it include: CVE-2026-44487 / GHSA-p92q-9vqr-4j8v (`>=1.0.0 <1.16.0`, proxy credentials may leak to an origin after redirect); CVE-2026-44494 / GHSA-35jp-ww65-95wh (`>=1.0.0 <1.16.0`, prototype-pollution proxy gadget / MITM); CVE-2026-44496 / GHSA-hfxv-24rg-xrqf (`>=1.0.0 <1.16.0`, cookie-name ReDoS); and CVE-2026-42264 / GHSA-q8qp-cvcw-x6jj (`>=1.0.0 <1.15.2`, prototype-pollution HTTP-adapter gadgets). Upgrade target is at least `axios@1.16.0` (normally by updating SendGrid or enforcing a compatible resolution). SendGrid outbound mail makes server-side axios execution **plausible**, though exploitability depends on proxy/redirect use, attacker-influenced config, or a separate prototype-pollution primitive. **Confidence: high (presence/ranges), medium-low (specific reachability).** [Credential leak](https://github.com/advisories/ghsa-p92q-9vqr-4j8v) · [MITM gadget](https://github.com/advisories/ghsa-35jp-ww65-95wh) · [ReDoS](https://github.com/advisories/ghsa-hfxv-24rg-xrqf) · [HTTP gadget](https://github.com/advisories/ghsa-q8qp-cvcw-x6jj)

3. **High conditional — `nodemailer@8.0.6` is affected by several reviewed advisories.** It is a direct runtime dependency. Notable current ranges: GHSA-r7g4-qg5f-qqm2 (`<=8.0.7`, fixed `8.0.8`) allows OAuth2 credential interception because the internal token fetch disables TLS certificate verification; GHSA-268h-hp4c-crq3 and GHSA-wqvq-jvpq-h66f (`<=8.0.8`, fixed `8.0.9`) cover List-header CRLF injection and `jsonTransport` bypass of file/URL access controls; GHSA-p6gq-j5cr-w38f (`<=9.0.0`, fixed `9.0.1`) covers message-level `raw` bypass enabling file read/SSRF. Upgrade to `>=9.0.1` closes all listed ranges. Exposure is **production-present but feature-conditional**: OAuth2, attacker-controlled `list` comments, `jsonTransport`, or attacker-controlled `raw` must be used. **Confidence: high (presence/ranges), low-medium (reachability).** [TLS advisory](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2) · [header injection](https://github.com/advisories/GHSA-268h-hp4c-crq3) · [jsonTransport bypass](https://github.com/advisories/GHSA-wqvq-jvpq-h66f) · [raw SSRF/file read](https://github.com/advisories/GHSA-p6gq-j5cr-w38f)

4. **Supply-chain reproducibility is weak because all executable upstream references float.** `frontend/Dockerfile` uses `oven/bun:1` and `oven/bun:1-slim` without digests; Compose uses `postgres:16-alpine`, `redis:7-alpine`, and especially `dpage/pgadmin4:latest`; CI uses `actions/checkout@v4`, `oven-sh/setup-bun@v2`, and `bun-version: latest`. Tags can move, so identical source can execute different build/action/image content. Pin image digests, full 40-character action SHAs, and an explicit Bun patch version. This is a build/CI integrity risk; Compose services appear local/dev, while the Bun runner image is production-reachable. **Confidence: high.** [Docker digest policy](https://docs.docker.com/build/policies/validate-images/) · [GitHub SHA-pinning policy](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/) · [setup-bun version behavior](https://github.com/oven-sh/setup-bun)

5. **The production image contains dev/tooling dependencies.** The deps stage runs `bun install` without production omission and runner copies the complete `/app/node_modules`; therefore ESLint, Vitest, jsdom, compiler/native packages, etc. enter the runtime image even if unreachable. This widens SBOM and compromise surface. `minimatch@10.2.4` is present only through tooling and is beyond the known `10.0.0–10.2.2` ReDoS ranges; no finding is asserted. Build with a production-only dependency stage after compilation. **Confidence: high.**

6. **No finding for `marked@18.0.2`; avoid a false positive.** GHSA-6v9c-7cg6-27q7 affects `18.0.0–18.0.1`; `18.0.2` is patched. Likewise `jszip@3.10.1` is beyond the old `<3.7.0` prototype-pollution range and `@auth/core@0.41.2` is beyond the reported `<0.41.1` email-validation issue. **Confidence: high.** [Marked upstream advisory](https://github.com/markedjs/marked/security/advisories/GHSA-6v9c-7cg6-27q7)

7. **External service SBOM boundary.** Runtime integrations evident from the manifest/project configuration are Railway-hosted PostgreSQL, SendGrid, Stripe, Google OAuth, and Railway deployment. These are vendor-managed APIs/services rather than repository-resolved software versions, so no package CVE was attributed to them. `postgres:16-alpine`, `redis:7-alpine`, and pgAdmin are Compose references, apparently local/dev rather than the Railway production topology. Exact deployed Railway base-image digest and managed PostgreSQL engine patch level require credentialed environment evidence. **Confidence: medium-high.**

## SBOM-oriented inventory excerpt

| Component | Relationship | Resolved/reference | Exposure | Advisory status |
|---|---|---:|---|---|
| sanitize-html | direct npm | 2.17.3 | production | affected; fix 2.17.4 |
| nodemailer | direct npm | 8.0.6 | production, conditional features | affected; fix >=9.0.1 for listed set |
| @sendgrid/mail → axios | transitive npm | 8.1.6 → 1.13.6 | production outbound HTTP | affected; axios fix >=1.16.0 |
| marked | direct npm | 18.0.2 | production | patched for cited GHSA |
| minimatch | transitive tooling | 10.2.4 | dev/tooling, but shipped in image | patched for cited ReDoS set |
| oven/bun | OCI base | `1`, `1-slim` | build + production | mutable/unresolved digest |
| actions/checkout | GitHub Action | `v4` | CI | mutable tag |
| oven-sh/setup-bun | GitHub Action | `v2`; Bun `latest` | CI | mutable action and runtime |
| postgres / redis / pgAdmin | OCI Compose | `16-alpine` / `7-alpine` / `latest` | local/dev hypothesis | mutable/unresolved digest |

## Sources
- Kept: GitHub reviewed/upstream advisories linked per finding — authoritative affected and patched ranges.
- Kept: Docker documentation and GitHub changelog — primary pinning guidance.
- Kept: repository `frontend/package.json`, `frontend/bun.lock`, `frontend/Dockerfile`, `.github/workflows/ci.yml`, and `docker-compose.yml` — direct component/version evidence.
- Dropped: Snyk summaries and generic Dependabot/SEO pages — redundant where primary GitHub advisories existed.
- Dropped: advisories whose affected ranges do not include the resolved version (except explicit false-positive notes).

## Gaps
- Tool access did not provide a directory listing, Git/OSV audit executable, or container registry inspection; undiscovered workflow/Docker files and OS packages inside the current `oven/bun` manifests remain possible.
- Reachability was classified from dependency relationships and deployment structure, not a full call-site/dataflow review.
- Floating OCI tags prevent determining an installed OS package SBOM or matching base-image CVEs at HEAD. Resolve deployed digests, generate CycloneDX/SPDX plus an image SBOM, and scan those immutable artifacts.
- Verify the deployed Railway revision, managed PostgreSQL patch version, and whether Nodemailer conditional features or axios proxy settings are actually used.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Produced only the requested advisory/SBOM artifact; no project or source files were modified."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Exact resolved versions, affected/patched ranges, exposure classifications, confidence, repository evidence, and primary advisory URLs are included."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/0a942041-338c-4359-b2b2-e6dabedccf5b/audit/advisory-supply-chain.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [],
  "validationOutput": [
    "Read package.json, full bun.lock, frontend/Dockerfile, .github/workflows/ci.yml, and docker-compose.yml; excluded .worktrees by using canonical absolute paths.",
    "Cross-checked asserted vulnerable ranges against GitHub reviewed or upstream security advisories.",
    "No application tests were appropriate because this was a read-only intelligence task."
  ],
  "residualRisks": [
    "No executable Git/OSV/container scan or registry digest resolution was available; OS-level and any unlisted-file coverage remains incomplete.",
    "Production reachability for conditional library features requires call-site/dataflow verification.",
    "Floating image/action/runtime references prevent a reproducible complete SBOM."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added one audit artifact; no project/source changes.",
  "reviewFindings": [
    "blocker: sanitize-html@2.17.3 is in the affected <=2.17.3 range for CVE-2026-44990.",
    "blocker: transitive axios@1.13.6 is below the 1.16.0 safe line for multiple reviewed 2026 advisories.",
    "blocker: nodemailer@8.0.6 is affected by multiple reviewed advisories; feature reachability must be verified.",
    "warning: production OCI images, CI actions, and Bun runtime use mutable references."
  ],
  "manualNotes": "The user-required workflow tool was not exposed in this child session; research was completed with the available read and web research tools. noStagedFiles reflects that no project/source files were edited; Git status itself could not be executed."
}
```
