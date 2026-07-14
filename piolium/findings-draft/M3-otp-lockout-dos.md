# Anonymous OTP attempts can lock arbitrary accounts

Phase: 10
Sequence: 004
Slug: otp-lockout-dos
Verdict: VALID
Rationale: A public attacker controls the victim email and invalid code, and each failure mutates durable account lockout state without endpoint/IP throttling.
Adversarial-Verdict: not required (P11-LITE Medium)
Severity-Original: MEDIUM
Severity-Final: MEDIUM
PoC-Status: theoretical
Pre-FP-Flag: none
Debate: piolium/chamber-workspace/auth-billing/debate.md

Final report: `piolium/findings/M3-otp-lockout-dos/report.md`.
