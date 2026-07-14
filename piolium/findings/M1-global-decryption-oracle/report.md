# M1 — Any authenticated account can use the global application-key decrypt oracle

Severity: MEDIUM
Verdict: VALID
PoC-Status: executed
Environment: local route harness using the real route and AES implementation with an authenticated `event.locals` session.

## Summary

`POST /api/decrypt` accepts arbitrary ciphertext, IV, and authentication tag from any authenticated user and decrypts them with the same process-wide key used for every stored server share. It performs no tenant, secret, purpose, version, or recent-authentication binding.

## Location

- `frontend/src/routes/api/decrypt/+server.ts:12-31`
- `frontend/src/lib/encryption.ts:41-79,121-138`
- `frontend/src/routes/api/secrets/+server.ts:141-166`

## Attacker prerequisites

Any valid low-privilege account plus a valid ciphertext/IV/tag tuple encrypted under version 1, obtained through a separate database, backup, log, or ciphertext exposure. No ownership of the corresponding secret is required.

## Evidence

The route checks only that a session exists, then calls `decryptMessage`. The key lookup is global by key version. A local test sent a ciphertext created under the application key through the actual route with an unrelated user ID and received the plaintext.

## Impact

A read-only ciphertext compromise can be upgraded to plaintext server-share disclosure. One share is normally below the Shamir threshold, which limits severity, but the endpoint defeats encryption-at-rest separation.

## Reproduction

See `poc.md` and `evidence/decrypt-oracle-poc.log`.
