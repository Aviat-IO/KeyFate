# Server reaches the Shamir reconstruction threshold

Phase: 10
Sequence: 001
Slug: server-reaches-shamir-threshold
Verdict: VALID
Rationale: A normal low-privilege user's 2-of-3 Nostr setup sends two distinct plaintext shares through the application process, crossing the documented zero-knowledge boundary.
Adversarial-Verdict: CONFIRMED
Adversarial-Rationale: Fresh cold review independently traced shares[0] and shares[1] into server endpoints and confirmed the default threshold is two.
Severity-Original: HIGH
Severity-Final: HIGH
PoC-Status: theoretical
PoC-Block-Reason: No credentialed staging instrumentation; real library reconstruction executed locally.
Pre-FP-Flag: none
Debate: piolium/chamber-workspace/crypto-custody/debate.md

Final report: `piolium/findings/H1-server-reaches-shamir-threshold/report.md`.
