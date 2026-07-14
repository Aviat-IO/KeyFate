# Security rate limits are non-atomic and fail open

Phase: 10
Sequence: 006
Slug: rate-limit-race
Verdict: VALID
Rationale: A remote attacker can issue concurrent requests that collapse multiple absolute writes to one increment; exceptions authorize requests.
Adversarial-Verdict: not required (P11-LITE Medium)
Severity-Original: MEDIUM
Severity-Final: MEDIUM
PoC-Status: theoretical
Pre-FP-Flag: none
Debate: piolium/chamber-workspace/auth-billing/debate.md

Final report: `piolium/findings/M5-rate-limit-race/report.md`.
