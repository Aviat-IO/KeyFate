# M2 — NIP-59 recovery accepts unauthenticated attacker-authored shares

Severity: MEDIUM
Verdict: VALID
PoC-Status: executed
Environment: local production-library flow using a deliberately invalid seal signature.

## Summary

The recovery path decrypts gift wraps but does not verify the outer event, seal signature, recipient binding, rumor identity/kind, author consistency, or expected KeyFate publisher. Any Nostr user can publish decryptable attacker-controlled shares to a known recipient pubkey.

## Location

- `frontend/src/lib/crypto/recovery-flows.ts:110-142`
- `frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:89-146`
- Correct signing exists in `frontend/src/lib/nostr/gift-wrap.ts:75-114`, but recovery does not validate it.

## Attacker prerequisites

Knowledge of the recipient npub and ability to publish to a queried relay. The recipient must select/process the malicious event.

## Evidence

The code checks only kinds 1059 and 13 before decrypting/parsing. It never calls Nostr event verification. Official NIP-44 requires validating event pubkey/signature before decryption. A local PoC wrapped a seal whose ID and signature were all zeroes; `unwrapGiftWrap` still returned the attacker-controlled share.

## Impact

Recovery-integrity failure: relay injection can poison or confuse recovery, substitute metadata, and cause reconstruction of attacker-chosen or invalid material. No recipient private-key disclosure was demonstrated.

## Reproduction

See `poc.md` and `evidence/nip59-poc.log`.
