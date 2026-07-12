# M7 — Database-stored bearer tokens unlock plaintext server shares

Severity: MEDIUM
Verdict: VALID
PoC-Status: theoretical
PoC-Block-Reason: No disposable database/application environment was available; the token-to-decrypt path is direct and unauthenticated.

## Summary

Check-in bearer tokens are stored in plaintext in the same database as encrypted server shares. The unauthenticated server-share endpoint accepts that token and secret ID, decrypts the share with the application key, and returns plaintext. A read-only database compromise can therefore use the live application as a decryption service.

## Location

- `frontend/src/lib/db/schema.ts:371-390`
- `frontend/src/lib/cron/check-secrets.ts:167-176`
- `frontend/src/routes/api/secrets/[id]/server-share/+server.ts:10-95`

## Attacker prerequisites

Read access to `check_in_tokens` during the 30-day token validity window and network access to the application. No KeyFate account is required. The route allows a 24-hour grace period after first use.

## Evidence

The schema stores the exact token and the route queries `eq(checkInTokens.token, token)`. On success it loads the encrypted share, calls `decryptMessage`, and returns `{ serverShare: decryptedServerShare }` without session authentication.

## Impact

Exposure of one Shamir recovery factor for every compromised active token, defeating the claimed ciphertext-only protection of a read-only database breach. A second share is still required for normal threshold reconstruction.

## Reproduction

See `poc.md`.
