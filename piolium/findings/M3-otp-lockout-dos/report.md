# M3 — Unauthenticated OTP verification can lock an arbitrary account

Severity: MEDIUM
Verdict: VALID
PoC-Status: theoretical
PoC-Block-Reason: A disposable PostgreSQL environment was not available; the complete persistent state transition was traced and cold-verified.

## Summary

The public OTP verification endpoint lets an attacker submit a victim email and invalid eight-digit codes without endpoint/IP throttling. Invalid codes increment persistent account lockout state even when no valid OTP was requested.

## Location

- `frontend/src/routes/api/auth/verify-otp/+server.ts:11-29`
- `frontend/src/lib/auth/otp.ts:161-204,251-306`

## Attacker prerequisites

Knowledge of a victim email; no account, valid OTP, Turnstile token, or victim interaction.

## Evidence

Five invalid attempts set a one-hour lock, ten accumulated attempts set a 24-hour lock, and twenty permanently lock OTP authentication. The separate `verificationTokens.attemptCount` limiter is ineffective because failed attempts never increment that field. The attacker can resume after each lock expires.

## Impact

Targeted denial of OTP login, eventually permanent for OTP-only users until support/database intervention. Password or Google login may remain available for users who configured them.

## Reproduction

See `poc.md`.
