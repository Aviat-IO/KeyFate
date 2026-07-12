# Review Chamber — authentication and billing

Status: CLOSED

## Round 1 — Attack Ideator

Hypotheses: arbitrary-email OTP lockout; generic JSON CSRF; state-changing checkout GET; non-atomic rate limiting; Stripe lookup-key underpayment; BTCPay currency underpayment.

## Round 2 — Code Tracer

- OTP: public `verify-otp` accepts victim email/code and calls `verifyOtp`; failures mutate persistent user lock state. REACHABLE.
- JSON CSRF: SvelteKit production origin checks and cookie behavior block proposed cross-site unsafe JSON/form path. UNREACHABLE.
- Checkout GET: authenticated GET invokes provider creation; GET is outside unsafe-method origin check and Lax cookies accompany top-level navigation. REACHABLE.
- Rate limit: read count then absolute `count+1` update; catch returns success. REACHABLE under concurrent requests.
- Stripe: query-controlled lookup key searches all active prices; checkout completion grants Pro without selected-price validation. PARTIAL/REACHABLE when another cheaper active recurring price exists.
- BTCPay: query-controlled currency reinterprets 9/90, but official webhook metadata is top-level while adapter forwards `raw.data`; shipped entitlement path is broken first. PARTIAL, latent after integration repair.

## Round 3 — Devil's Advocate

- OTP alternate Google/password login narrows impact but does not protect OTP-only users.
- SvelteKit origin protection defeats broad custom-CSRF claim; drop it.
- GET navigation cannot complete payment but still creates attributable provider objects.
- Total database outage also breaks downstream work, narrowing fail-open, but lost updates and transient errors remain.
- Stripe subscription events may later map unknown prices to free, but ordering/delivery is not enforced and checkout completion can grant Pro.
- BTCPay underpayment is not presently promoted because metadata adapter mismatch prevents entitlement in the official payload shape.

## Round 4 — Chamber Synthesizer

- VALID MEDIUM: OTP lockout (M3).
- FALSE POSITIVE: generic JSON CSRF.
- VALID MEDIUM: state-changing checkout GET (M4).
- VALID MEDIUM: rate-limit race/fail-open (M5).
- VALID MEDIUM, configuration-dependent: Stripe price allowlist (M6).
- PRODUCTION BLOCKER / latent variant: BTCPay adapter and currency validation.

Chamber closed after cold web review and independent payment follow-up agreed with these dispositions.
