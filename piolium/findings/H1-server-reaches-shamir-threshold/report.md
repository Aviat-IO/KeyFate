# H1 — Server reaches the Shamir reconstruction threshold

Severity: HIGH
Verdict: VALID
PoC-Status: theoretical
PoC-Block-Reason: No credentialed production/staging instrumentation was available; the real Shamir library reconstruction was executed locally and the server receipt path was traced in source.

## Summary

When Nostr recovery is enabled, KeyFate sends the server one plaintext Shamir share during secret creation and then sends at least one additional plaintext user-managed share to the server-side Nostr publisher. In the shipped default 2-of-3 configuration, the application trust domain therefore receives enough shares to reconstruct the original secret, contradicting the advertised zero-knowledge boundary.

## Location

- `frontend/src/lib/components/NewSecretForm.svelte:158-205,229-249`
- `frontend/src/routes/api/secrets/+server.ts:141-166`
- `frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:88-104,147-155`
- `frontend/src/lib/services/nostr-publisher.ts:119-143`

## Attacker / trust-boundary prerequisites

A compromised application process, malicious operator instrumentation, or supply-chain code running while a user creates a secret with Nostr publishing enabled. No database decryption or browser compromise is required at that moment.

## Evidence

`NewSecretForm` creates all shares in the browser, posts `shares[0]` to `/api/secrets`, and later posts `userManagedShares[idx]` to `/publish-nostr`. Both requests are plaintext at the application layer after TLS termination. The publisher encrypts the second share only after the server receives it. The local proof confirmed that shares 0 and 1 reconstruct a 2-of-3 secret.

## Impact

Complete disclosure of user secret plaintext to a server trust domain explicitly represented as unable to reconstruct it. This is systemic for normal 2-of-3 Nostr-enabled creation and invalidates the zero-knowledge claim.

## Reproduction

See `poc.md` and `evidence/shamir-reconstruction.log`.
