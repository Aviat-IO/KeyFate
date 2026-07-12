# Cross-site GET creates payment-provider objects

Phase: 10
Sequence: 005
Slug: state-changing-checkout-get
Verdict: VALID
Rationale: Authenticated top-level cross-site navigation carries SameSite=Lax cookies to GET handlers that create provider resources.
Adversarial-Verdict: not required (P11-LITE Medium)
Severity-Original: MEDIUM
Severity-Final: MEDIUM
PoC-Status: theoretical
Pre-FP-Flag: none
Debate: piolium/chamber-workspace/auth-billing/debate.md

Final report: `piolium/findings/M4-state-changing-checkout-get/report.md`.
