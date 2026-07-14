# KeyFate recovery architecture review

## Review

- **Correct:** Secret splitting starts in the browser (`frontend/src/lib/components/NewSecretForm.svelte:27,171-174`), and the recovery page keeps reconstruction state in browser memory (`frontend/src/routes/recover/+page.svelte`, `recoveredShares`). The Bitcoin persistence endpoint is already shaped to accept transaction artifacts rather than private keys (`frontend/src/routes/api/secrets/[id]/store-bitcoin/+server.ts`). These are useful boundaries to preserve.
- **Blocker:** The normal 2-of-3 flow stores share 0 on the server (`frontend/src/lib/components/NewSecretForm.svelte:174,182`) and sends other plaintext Shamir shares to a server publisher (`frontend/src/lib/components/NewSecretForm.svelte:239`; `frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:62-75,123-145`). Thus the server observes enough shares to reconstruct under the default threshold. Server-side encryption of its stored share does not change that trust fact.
- **Blocker:** `unwrapGiftWrap` decrypts and parses the outer wrap, seal, rumor, and payload without verifying event IDs/signatures, the outer `p` binding, seal-to-rumor author equality, expected publisher identity, rumor kind/id, or contextual field consistency (`frontend/src/lib/crypto/recovery-flows.ts`, `unwrapGiftWrap`, approximately lines 103-139). A decryptable object is not sufficient publisher authenticity.
- **Blocker:** The publisher serializes `share` as JSON containing `encryptedShare`, `nonce`, and `encryptedKNostr` (`frontend/src/lib/services/nostr-publisher.ts:130-142`), while Nostr recovery passes the entire `share` string to `hexToBytes` and asks users for a separate nonce/K source (`frontend/src/lib/components/recovery/NostrRecoveryStep.svelte`, approximately lines 149-185). `encryptedKNostr` is never used. Bitcoin recovery instead expects the fetched outer event content itself to be plaintext JSON (`frontend/src/lib/components/recovery/BitcoinRecoveryStep.svelte:67-90`), although the referenced publisher event is a signed, encrypted kind-1059 gift wrap.
- **Blocker:** The current Bitcoin service requires a recipient private key during enable and every refresh (`frontend/src/lib/services/bitcoin-service.ts:38-54,148-164,239-254`), while browser key custody is only `sessionStorage` (`frontend/src/lib/bitcoin/client-wallet.ts`). Loss/closure strands the branch. The actual recipient needs the fully signed transaction whose output pays an address they control; they should not depend on an owner browser's session-only key.
- **Note:** Bitcoin setup is presently not launch-ready despite extensive crypto-unit scaffolding. The current tests construct both owner and “recipient” keys in-process (`frontend/src/lib/__tests__/e2e-bitcoin-nostr.test.ts:65-68`) and therefore prove transaction mechanics, not recipient custody or delivery.

## Minimal Telos-aligned target architecture

### Purpose and launch invariants

The purpose is recipient recovery after timeout without making KeyFate a secret custodian. The smallest architecture satisfying that purpose has these invariants:

1. Original secret, Shamir shares, per-share key `K`, and all signing operations exist only in browser clients.
2. KeyFate may retain/release exactly one plaintext-equivalent Shamir share; no request may contain any other plaintext share or a key capable of opening it.
3. Every recoverable network artifact is authenticated and bound to one secret, recipient, share index, threshold scheme, and format version.
4. Bitcoin recovery leaves spendable funds at an address controlled by the real recipient and gives that recipient a complete signed transaction; no server-held or session-held private key is required at recovery.
5. Legacy or partially provisioned records fail closed and visibly require re-enrollment; launch must not claim recoverability from scaffolding tests.

### Canonical recovery capsule (client created)

For default 2-of-3, define the roles explicitly:

- **S0 service share:** browser sends only S0 to the existing server-share path; released by the existing disclosure token flow.
- **S1 recipient recovery share:** browser encrypts S1 under random `K` and publishes an authenticated **v2 recovery capsule**. Neither S1 nor K is posted to KeyFate.
- **S2 owner/offline backup:** exported locally; never posted to KeyFate or to the Nostr publisher API.

Use one canonical, owner-signed Nostr event (new dedicated kind or versioned existing custom kind) whose strict content is:

```text
{
  version: 2,
  secretId,
  recipientId,
  recipientNostrPubkey,
  shareIndex,
  threshold,
  totalShares,
  encryptedShareHex,
  nonceHex,
  encryptedKNostr
}
```

The browser signs and publishes this capsule directly. KeyFate may optionally relay an already-signed opaque event, but the endpoint must reject any plaintext `share`/`K` fields and must not possess the publisher signing key. A NIP-59 gift wrap can privately deliver the capsule event ID; its seal is signed by the same owner publisher key. The recipient's invitation/recovery manifest must carry the expected per-secret publisher public key and recipient binding. Store only these public bindings server-side.

This two-artifact layout resolves the UI mismatch: Nostr recovery unwraps an authenticated pointer, fetches/verifies the signed capsule, decrypts `encryptedKNostr` with recipient nsec, then decrypts `encryptedShareHex` with the capsule nonce. Bitcoin recovery extracts `K + capsuleEventId` from the signed transaction, fetches/verifies the same public ciphertext capsule, and decrypts it without pretending kind-1059 content is plaintext JSON.

### Full NIP-59 verification contract

Before returning a capsule reference or payload, browser recovery MUST:

1. Verify the outer event hash/signature, kind 1059, and exactly matching recipient `p` tag.
2. Decrypt and strictly parse the seal; verify seal hash/signature and kind 13.
3. Require `seal.pubkey === expectedPublisherPubkey` from the invitation/manifest.
4. Decrypt and strictly parse the rumor; recompute its id, require the expected KeyFate kind, and require `rumor.pubkey === seal.pubkey`.
5. Strictly validate the v2 capsule/pointer schema and require secretId, recipientId/pubkey, shareIndex, threshold, totalShares, capsule event ID, and publisher key to match the selected recovery context.
6. Verify the fetched canonical capsule's event hash/signature and publisher before using any ciphertext. Deduplicate by event/capsule ID and reject conflicting metadata rather than combining it.

Use `nostr-tools` verification primitives rather than hand-rolled signature checks.

### Bitcoin custody and delivery

Keep the existing CSV two-branch script, but rename the ELSE key concept to a **one-time branch signing key**. It is generated in the owner's browser, used to sign the complete recipient-path transaction after the funding outpoint is known, and then destroyed. The transaction's spend output MUST pay a Bitcoin address supplied by the actual recipient (network-validated and confirmed out of band/in an authenticated recipient claim). Recovery therefore requires only broadcasting the complete transaction; the recipient spends the resulting ordinary output with their own wallet key.

The browser must encrypt the complete pre-signed transaction to the recipient's registered Nostr public key before upload. The server stores/releases only that ciphertext plus public lifecycle metadata. It must never receive the branch private key, recipient wallet private key, `K`, or plaintext pre-signed transaction. Every refresh creates a new UTXO, new one-time branch key, new signed transaction, and new recipient-encrypted delivery envelope; only after successful persistence/publish does the old state become superseded. The recipient recovery UI obtains and locally decrypts the **current** transaction, validates input outpoint, sequence, witness script, capsule ID/K payload, network, and payment output/address before broadcast.

Important limitation to state honestly: OP_RETURN data in a pre-signed transaction is readable by anyone who receives the transaction before maturity. CSV prevents broadcast, not inspection. Encrypting the transaction to the recipient prevents KeyFate from learning K, but does not cryptographically prevent the recipient from learning K early if they obtain the envelope. If pre-deadline recipient secrecy is a launch requirement, this construction is insufficient and requires a separate cryptographic design (not a bug-fix extension).

## Required OpenSpec delta

Create an approved cross-cutting change such as `fix-recovery-trust-boundaries` with `design.md` and deltas for both current capabilities before implementation.

### `openspec/specs/nostr-encrypted-delivery/spec.md`

Current contradictions requiring **MODIFIED** requirements:

- **Double Encryption of Shares / Nostr Share Publishing Service:** currently requires the server service to receive shares, double-encrypt them, hold a sender secret key, and return plaintext K. This contradicts `openspec/project.md`'s client-only processing and one-server-share guarantees.
- **NIP-59 Gift Wrap Event Construction:** calls the author the “KeyFate server key”; target author is the owner client, with an expected public identity bound into recovery material.
- **K Recovery via Nostr / Nostr Recovery UI:** does not require publisher/signature/context verification and describes K selection via passphrase/OP_RETURN rather than consuming the included `encryptedKNostr`.
- Add requirements for the signed v2 canonical recovery capsule, strict NIP-59 verification/binding, direct client publication (or opaque signed-event relay), and v1 rejection/compatibility behavior.

### `openspec/specs/bitcoin-timelock-delivery/spec.md`

Current contradictions requiring **MODIFIED** requirements:

- **Pre-Signed Recipient Transaction:** requires `recipient private key` during construction but does not define how the real recipient controls it or receives the resulting transaction.
- **Client-Side Bitcoin Key Management:** mandates session-only owner and recipient private keys, which is incompatible with refresh continuity and recipient usability.
- **Server-Side Bitcoin UTXO Lifecycle / Database Schema:** permits plaintext pre-signed transaction storage and server-side creation even though transaction content contains K.
- **Bitcoin Recovery UI:** assumes referenced Nostr event content is directly parseable rather than verifying/fetching the canonical signed capsule.
- Add requirements for actual-recipient destination ownership/confirmation, ephemeral branch signing key destruction, recipient-encrypted transaction delivery, current-generation binding, and local transaction validation before broadcast.

Also update `openspec/project.md` future-integration language: Nostr/Bitcoin are launch requirements, not future optional services. Do not silently edit archived changes; deltas modify current specs.

## Phased TDD implementation plan

### Phase 0 — executable contracts, no production behavior

1. Add v2 capsule schemas/types in `frontend/src/lib/crypto/recovery-flows.ts` (or a focused `recovery-capsule.ts`).
2. Extend `frontend/src/lib/__tests__/recovery-ui.test.ts` with failing tests for publisher signature, tampered outer/seal/capsule, wrong `p`, wrong expected publisher, rumor/seal author mismatch, cross-secret/cross-recipient substitution, conflicting share metadata, and the real `{encryptedShare,nonce,encryptedKNostr}` round trip.
3. Extend `frontend/src/lib/__tests__/nostr.test.ts` with failing v2 capsule and complete NIP-59 verification tests.
4. Replace the misleading mocked pipeline cases in `frontend/src/lib/__tests__/e2e-bitcoin-nostr.test.ts` with a failing full v2 capsule → Nostr K recovery and capsule → Bitcoin K recovery test.

Gate: no production change until the OpenSpec delta validates strictly and these tests demonstrate the current failures.

### Phase 1 — remove the server from S1 creation/publication

1. Move `doubleEncryptShare`, capsule signing, gift wrapping, and relay publication into a browser-only orchestration module called from `frontend/src/lib/components/NewSecretForm.svelte`.
2. Retire or narrow `frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts` to accept only a validated signed opaque event; remove `NOSTR_SERVER_SECRET_KEY`, plaintext shares, passphrase, and plaintext K from its contract.
3. Refactor `frontend/src/lib/services/nostr-publisher.ts` into a client-safe publisher or delete the server service after callers migrate.
4. Update `frontend/src/routes/api/secrets/[id]/publish-nostr/__tests__/publish-nostr.test.ts` to assert plaintext share/K fields are rejected and ownership-bound signed artifacts are accepted.
5. Add/update `frontend/src/lib/__tests__/secret-bitcoin-flow.test.ts` and `frontend/src/lib/__tests__/client-operations.test.ts` to assert the complete default creation request trace contains only S0 plaintext-equivalent and never S1/S2/K.

Gate: an integration test instruments all fetch bodies during default 2-of-3 setup and proves the server cannot reconstruct any second share.

### Phase 2 — authenticated, format-correct Nostr recovery

1. Implement the verification contract in `frontend/src/lib/crypto/recovery-flows.ts` using strict schemas and `nostr-tools` verification.
2. Update `frontend/src/lib/components/recovery/NostrRecoveryStep.svelte` to consume capsule fields directly, recover K from `encryptedKNostr`, and remove manual nonce/K prompts for the Nostr path.
3. Update `frontend/src/lib/components/recovery/BitcoinRecoveryStep.svelte` to fetch and authenticate the canonical capsule, not parse kind-1059 ciphertext as JSON; eliminate `any` casts.
4. Add component tests (new `frontend/src/lib/components/recovery/__tests__/NostrRecoveryStep.test.ts` and `BitcoinRecoveryStep.test.ts`) for success and fail-closed authenticity/binding errors.
5. Ensure `frontend/src/routes/recover/+page.svelte` only combines shares with identical secret/threshold/version context.

Gate: real-crypto browser-level test recovers S0+S1 and reconstructs the original secret; every tamper/substitution variant fails before decryption/combination.

### Phase 3 — recipient-usable Bitcoin provisioning

1. Refactor `frontend/src/lib/bitcoin/client-wallet.ts`: persist no recipient wallet private key; introduce an in-memory one-time branch signer and explicit destruction. Owner refresh credentials need a durable owner-controlled strategy (wallet signing or an encrypted owner backup), never sessionStorage as the sole launch custody.
2. Refactor transaction orchestration so the browser creates the funding/refresh and complete recipient-path transaction paying the recipient-supplied address. Keep pure transaction builders in `frontend/src/lib/bitcoin/transaction.ts`.
3. Change `frontend/src/routes/api/secrets/[id]/store-bitcoin/+server.ts` and `store-bitcoin-refresh/+server.ts` to accept only recipient-encrypted pre-signed-transaction envelopes plus validated public metadata.
4. Remove private-key-taking server APIs/service paths from `frontend/src/lib/services/bitcoin-service.ts` or constrain the service to persistence/status only.
5. Add endpoint tests beside both store routes, extend `frontend/src/lib/__tests__/client-wallet.test.ts`, `bitcoin.test.ts`, `bitcoin-service.test.ts`, `confirm-utxos.test.ts`, and `e2e-bitcoin-nostr.test.ts` to prove: no private key/K/plain tx crosses fetch; output pays recipient address; signature remains valid after key destruction; envelope decrypts for recipient; stale generation is rejected; refresh replaces delivery atomically.
6. Remove the hard-disable only after the signet E2E proves funding confirmation → timeout-age transaction acceptance → recipient broadcast → recipient-controlled output spend. UI target: `frontend/src/lib/components/BitcoinSetup.svelte` (current enable button at line 477).

Gate: signet test with separate owner and recipient browser identities, including browser restart, demonstrates usable recipient funds and secret recovery without server-held private keys.

### Phase 4 — migration and compatibility

Use `bunx drizzle-kit generate`; commit SQL, snapshot, and journal together. Likely schema additions are expected publisher pubkey/capsule version+event ID on recipient delivery state, recipient Bitcoin destination/network binding, encrypted transaction envelope/version, and UTXO generation/current marker. Do not overwrite the existing plaintext column in place before rollout.

Rollout order:

1. Add nullable v2 columns and dual-read status reporting.
2. Deploy v2 creation only; mark v1 Nostr and Bitcoin records `legacy_reenrollment_required` in application behavior.
3. Offer owner re-enrollment that regenerates S1 delivery and the current Bitcoin UTXO transaction without attempting to “upgrade” unknown/lost private keys.
4. Recovery may retain a clearly labeled manual legacy path only if it can validate what legacy data actually supports. Never accept unsigned v1 artifacts as v2 or mix v1/v2 shares.
5. After measured re-enrollment, stop writing plaintext `pre_signed_recipient_transaction`; later drop/deprecate it in a separate generated migration.

Existing session-only Bitcoin records cannot be made reliable automatically when the browser session/key is gone. Existing Nostr events cannot gain publisher/context authenticity retroactively. Both require fail-closed status and owner action.

## Validation sequence for implementation

```text
cd frontend
bun test src/lib/__tests__/nostr.test.ts src/lib/__tests__/recovery-ui.test.ts
bun test src/lib/__tests__/e2e-bitcoin-nostr.test.ts src/lib/__tests__/secret-bitcoin-flow.test.ts
bun test src/routes/api/secrets/[id]/publish-nostr/__tests__/publish-nostr.test.ts
bun test src/lib/__tests__/client-wallet.test.ts src/lib/__tests__/bitcoin.test.ts src/lib/__tests__/bitcoin-service.test.ts
bun run check
bun run build
bun test
openspec validate fix-recovery-trust-boundaries --strict
```

No implementation should be considered launch-ready without the separate-identity signet acceptance test and a captured request-boundary assertion proving only one plaintext-equivalent share reaches KeyFate.