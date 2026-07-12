# P1 — Vulnerable sanitizer reaches an HTML sink

Priority: HIGH production gate
Security verdict: dependency and sink confirmed; no remote content-authoring path at audited HEAD
PoC-Status: executed
Environment: local installed dependency with KeyFate's exact blog allowlist.

## Summary

`sanitize-html@2.17.3` is affected by GHSA-rpr9-rxv7-x643 and is used immediately before a Svelte `{@html}` sink. The advisory's XMP/raw-text bypass survives KeyFate's exact allowlist. Current blog posts are source-controlled constants, so an unauthenticated stored-XSS path was not found at this commit.

## Location

- `frontend/bun.lock` resolves `sanitize-html@2.17.3`
- `frontend/package.json` declares it as a direct production dependency
- `frontend/src/routes/blog/[slug]/+page.svelte:5-41,139`
- `frontend/src/lib/blog/posts.ts` is the current trusted source

## Evidence

The local PoC transformed an XMP-wrapped script into `<script>audit()</script>` and preserved an XMP-wrapped image event handler. See `evidence/sanitize-html-poc.log`.

## Impact

Any future CMS/user-authored content path, compromised source/release input, or mistaken trust-boundary expansion becomes browser code execution. The absence of a Content-Security-Policy removes defense in depth.

## Production disposition

Upgrade/remove before release and keep content-authoring trust explicit. This is not counted as a currently remote-exploitable finding.
