# Database bearer token unlocks plaintext server share

Phase: 12
Sequence: 008
Slug: db-token-unlocks-server-share
Verdict: VALID
Rationale: A read-only database attacker controls an unexpired plaintext token accepted by an unauthenticated route that decrypts and returns a stored recovery factor.
Adversarial-Verdict: not required (P11-LITE Medium)
Severity-Original: MEDIUM
Severity-Final: MEDIUM
PoC-Status: theoretical
Pre-FP-Flag: none
Debate: piolium/chamber-workspace/crypto-custody/debate.md

Final report: `piolium/findings/M7-db-token-unlocks-server-share/report.md`.
