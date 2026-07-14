# M5 — Security rate limits are non-atomic and fail open

Severity: MEDIUM
Verdict: VALID
PoC-Status: theoretical
PoC-Block-Reason: No disposable concurrent PostgreSQL environment was available; the lost-update sequence is deterministic from the implementation.

## Summary

The database limiter reads a count and later writes `entry.count + 1` as an absolute value. Parallel requests can all observe the same count and overwrite one another, allowing bursts above the configured limit. Errors return `success: true`.

## Location

- `frontend/src/lib/rate-limit-db.ts:30-83`
- `frontend/src/lib/rate-limit.ts:29-42`
- `frontend/src/routes/api/auth/request-otp/+server.ts:57` (IP-aware OTP helper is not supplied an IP)

## Attacker prerequisites

Ability to issue parallel requests. Forwarded-IP spoofing additionally depends on Railway header normalization and is not assumed in severity.

## Evidence

There is no atomic `UPDATE ... count = count + 1`, row lock, transaction, or upsert with a guarded return. Two requests reading N both persist N+1. The catch block authorizes the request. The same database is required for most downstream actions, limiting fail-open impact during a total outage, but contention/transient errors and races remain relevant.

## Impact

Bypass of registration, secret-creation, check-in, and OTP-request abuse controls during bursts; potential email/provider cost and resource exhaustion.

## Reproduction

See `poc.md`.
