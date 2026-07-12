# CodeQL all-severity flow summary

- Official suite results: **45** across **13** rules.
- Database coverage: **252/252 extracted JavaScript/TypeScript production files**; tests, build output, dependencies excluded.
- Coverage limitation: **198 Svelte files, SvelteKit route semantics, Drizzle ORM wrappers, and Nostr relay boundaries were not structurally modeled**.
- Community JavaScript pack unavailable (GHCR 403).

## Results by rule

- `js/unused-local-variable`: 19
- `js/incomplete-multi-character-sanitization`: 6
- `js/clear-text-logging`: 3
- `js/path-injection`: 3
- `js/incomplete-url-scheme-check`: 2
- `js/incomplete-sanitization`: 2
- `js/bad-tag-filter`: 2
- `js/remote-property-injection`: 2
- `js/useless-assignment-to-local`: 2
- `js/incomplete-url-substring-sanitization`: 1
- `js/user-controlled-bypass`: 1
- `js/log-injection`: 1
- `js/insecure-temporary-file`: 1

## Security enrichment

- `js/path-injection` (3): false positive for traversal; path segments originate from generated/session user IDs and service-generated filenames. Export availability remains broken for separate operational reasons.
- custom URL-token query (4): relevant design signal; check-in/server-share bearer tokens appear in URLs.
- custom browser-storage query (2): relevant design signal; reconstruction shares and Nostr keys are script-readable.
- custom global-decrypt slice (1): confirmed route-to-shared-key decryption primitive; validated separately as Medium.
- sanitizer, logging, property-injection, and URL-check results: unused helpers, parameterized ORM use, or configuration/tooling-only; not promoted.
- GCM tag-length finding: hardening signal only; normal stored tags are 16 bytes and no practical forgery path was demonstrated.

## Custom queries executed

- `list-sources.ql`
- `list-sinks.ql`
- `keyfate-sensitive-url-token.ql`
- `keyfate-sensitive-browser-storage.ql`
- `slice-global-decrypt-oracle.ql`
