# Stripe checkout accepts unapproved active prices

Phase: 10
Sequence: 007
Slug: stripe-price-allowlist-bypass
Verdict: VALID
Rationale: Attacker-controlled lookup keys select any active recurring price and checkout completion can grant Pro without canonical product/amount validation.
Adversarial-Verdict: not required (P11-LITE Medium)
Severity-Original: MEDIUM
Severity-Final: MEDIUM
PoC-Status: blocked
PoC-Block-Reason: Live Stripe catalog contents and disposable payment account unavailable.
Pre-FP-Flag: configuration-dependent
Debate: piolium/chamber-workspace/auth-billing/debate.md

Final report: `piolium/findings/M6-stripe-price-allowlist-bypass/report.md`.
