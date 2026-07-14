# Summary

Cold verification was performed against `b7b7aef1a897c418e0402acd211fecf0206d8217`. Verdicts: **A is a TRUE POSITIVE (MEDIUM)**, with an important upstream defense for the outer signature; **B is a production blocker**; **C is a production blocker, not a false alarm**. No project/source files were modified.

`plan.md` was absent. `progress.md` describes an older Bitcoin demo/PR state and does not resolve these production paths.

# Decision / Approach

## Review

### Blocker B — production publisher and recovery UI are incompatible

**Verdict: production blocker (confirmed).**

The real publisher does not put ciphertext hex directly in `payload.share`. It puts a JSON string containing three fields:

- `encryptedShare`
- `nonce`
- `encryptedKNostr`

Evidence: `frontend/src/lib/services/nostr-publisher.ts:120-143`, especially the `JSON.stringify(...)` assignment at lines 133-138. `doubleEncryptShare` confirms that these are distinct outputs and that `encryptedKNostr` is the recipient's direct NIP-44 recovery path (`frontend/src/lib/crypto/double-encrypt.ts:73-101`).

`unwrapGiftWrap`, however, returns that complete JSON string unchanged as `UnwrappedShare.share` and discards its structure (`frontend/src/lib/crypto/recovery-flows.ts:132-142`). `NostrRecoveryStep` then:

1. treats `share.share` itself as hex (`frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:181-185`);
2. requires the nonce to be manually supplied in a separate input (`:177-185`, `:380-410`);
3. offers only passphrase or OP_RETURN recovery (`:331-357`), never calls the already-implemented `recoverKFromNostr` (`frontend/src/lib/crypto/recovery.ts:18-41`), and therefore never consumes `encryptedKNostr`.

`hexToBytes` also fails to validate hex digits and turns JSON character pairs into zero/partial values via `parseInt` assignment (`frontend/src/lib/crypto/hex-utils.ts:20-29`); the subsequent ChaCha20-Poly1305 authentication should reject the garbage rather than silently disclose plaintext (`frontend/src/lib/crypto/symmetric.ts:59-72`). This is a strong integrity defense, but it means legitimate production recovery fails.

**Why tests miss it:** recovery tests construct simplified `SharePayload.share` values containing direct ciphertext hex (`frontend/src/lib/__tests__/recovery-ui.test.ts:497-527`), while publisher tests only assert that an event was published and has kind 1059 (`frontend/src/lib/__tests__/secret-bitcoin-flow.test.ts:54-81`). No test feeds an actual `publishSharesToNostr` gift wrap through `unwrapGiftWrap` and the UI's consumption logic.

### Blocker C — Bitcoin is disabled, and key custody strands recipient funds

**Verdict: production blocker (confirmed), not a false alarm.**

The current hard stop is explicit and effective: `PLACEHOLDER_SYMMETRIC_KEY` is all zeroes (`frontend/src/lib/components/BitcoinSetup.svelte:56-60`), and `handleEnableBitcoin` always returns at lines 140-145. This is the strongest current defense: Bitcoin setup cannot presently broadcast the timelock through this UI.

Simply removing that guard would be unsafe:

- Both owner and recipient Bitcoin keys are generated in the owner's browser (`BitcoinSetup.svelte:86-103`).
- Private keys are stored only in `sessionStorage` (`frontend/src/lib/bitcoin/client-wallet.ts:28-68`), explicitly lasting only for the browser session (`:33-36`). There is no export/transfer of the recipient private key.
- The pre-signed CSV transaction spends the timelock to `recipientAddress` (`frontend/src/lib/bitcoin/transaction.ts:168-178`, `:225-245`). That address is derived from the same browser-generated recipient key (`BitcoinSetup.svelte:157-174`). Broadcasting the pre-signed transaction therefore moves BTC into a P2WPKH output that the actual recipient cannot subsequently spend without that undistributed private key.
- Refresh also requires both session-only keypairs and metadata; the application explicitly warns that refresh cannot occur after they disappear (`frontend/src/routes/(authenticated)/secrets/[id]/view/+page.svelte:166-173`, `:177-192`; `frontend/src/lib/components/BitcoinStatus.svelte:109-143`).

**Strongest counterargument considered:** the code creates a fully signed recipient transaction and stores it server-side (`frontend/src/lib/bitcoin/client-operations.ts:59-83`; `frontend/src/routes/api/secrets/[id]/store-bitcoin/+server.ts:104-118`), so the recipient private key is not needed to spend the *timelock input*. This does not solve custody: the transaction's recipient output is itself controlled by that same undistributed key. Additionally, the status response omits `preSignedRecipientTx` (`frontend/src/lib/services/bitcoin-service.ts:373-390`), while recovery-kit export tries to read it from `btcStatus.utxo` (`frontend/src/lib/components/ExportRecoveryKitButton.svelte:78-93`), so the advertised kit path receives `null` even though the database has a transaction.

There are also non-atomic loss windows: broadcast occurs before pre-signing (`frontend/src/lib/bitcoin/client-operations.ts:44-74`) and before server persistence (`BitcoinSetup.svelte:179-205`). The manually funded owner P2WPKH address is likewise controlled only by the session key. Production enablement requires durable/recoverable owner custody, actual recipient-controlled destination/key custody, delivery of the pre-signed transaction, and failure-safe sequencing—not deletion of the placeholder guard.

### Finding A — NIP-59 authenticity/binding checks are incomplete

**Verdict: TRUE POSITIVE — MEDIUM.**

Threat model: any Nostr user knows a recipient pubkey and can publish a correctly encrypted kind-1059 event tagged to that recipient. NIP-44 confidentiality proves the event was constructed for the recipient, but it does not establish that KeyFate or an expected secret owner authored it.

`unwrapGiftWrap` checks only outer kind 1059 and inner kind 13 before decrypting/parsing (`frontend/src/lib/crypto/recovery-flows.ts:110-142`). It does **not** perform the following NIP-59/application checks:

1. verify the outer event `id` and Schnorr `sig` against `giftWrap.pubkey` before decryption;
2. bind the outer `p` tag to the pubkey derived from `recipientSecretKey`;
3. verify the seal event `id` and Schnorr `sig` against `seal.pubkey`;
4. require seal tags to be empty;
5. require rumor kind 21059;
6. recompute/verify the unsigned rumor `id`;
7. require `rumor.pubkey === seal.pubkey` (NIP-59 author consistency);
8. bind `seal.pubkey` to the configured/trusted KeyFate publisher identity (the essential application-level authorization check);
9. schema-validate share metadata before accepting it.

The UI queries by kind and recipient p-tag (`frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:89-104`) but then accepts every returned event for selection and calls the unchecked function (`:122-146`). It displays the ephemeral outer pubkey as “From,” not the authenticated seal author (`:280-299`). An attacker can therefore create a validly signed/encrypted gift wrap and seal under attacker keys, choose arbitrary metadata and ciphertext, and have it accepted as an unwrapped share. This supports share injection, spoofing, and recovery denial/confusion; AEAD prevents learning the victim's secret and generally prevents an attacker-selected wrong key from producing authenticated plaintext, keeping severity at MEDIUM rather than HIGH.

**Important defense/caveat:** the production relay path uses `nostr-tools` `SimplePool` (`frontend/src/lib/nostr/client.ts:27-33`, `:67-74`), whose default relay subscription verifies outer events before returning them. Thus an invalid outer signature should be filtered upstream during the normal UI query. This narrows—but does not eliminate—the finding: attacker-authored outer events have valid attacker signatures, and neither seal authenticity nor trusted-author/rumor binding is enforced. `unwrapGiftWrap` is also exported and independently accepts invalid outer events.

A read-only executable PoC created an attacker event for a recipient, deliberately corrupted the outer `id`/signature and seal signature, changed the outer p-tag to a different pubkey, made `rumor.pubkey` claim an unrelated key, and changed rumor kind to 1. `unwrapGiftWrap` still returned:

```json
{"share":"deadbeef","secretId":"attacker","shareIndex":1,"threshold":1,"totalShares":1,"version":1}
```

Existing tests cover only valid round trips, wrong recipient decryption, and rejection of non-1059 outer kinds (`frontend/src/lib/__tests__/recovery-ui.test.ts:88-179`). They contain no negative signature, recipient-binding, rumor-kind/id, author-consistency, trusted-publisher, or schema tests.

### Correct defenses already present

- Publisher construction itself follows the rumor → signed empty-tag seal → signed ephemeral gift-wrap structure (`frontend/src/lib/nostr/gift-wrap.ts:53-64`, `:75-90`, `:102-114`).
- Production requires a persistent configured Nostr server key rather than silently using an ephemeral key (`frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:40-59`).
- NIP-44 and ChaCha20-Poly1305 authentication prevent ciphertext modification from yielding accepted plaintext.
- The Bitcoin placeholder guard currently prevents real funds from entering the incomplete UI flow.
- Pre-signing the timelock spend is useful, but it is not sufficient recipient custody or delivery.

# Artifacts

- `/Users/alancolver/dev/keyfate/.pi-subagents/artifacts/outputs/299cf632-9b0a-4aa8-b753-611c0bc425e1/audit-cold/nostr-bitcoin-fp.md` — this cold verification report.

# Validation

- Verified repository HEAD exactly matches requested `b7b7aef1a897c418e0402acd211fecf0206d8217`.
- Ran 102 focused Nostr, recovery, publisher/Bitcoin-flow, wallet, and client-operation tests: all passed. Their passing status does not contradict the blockers because the integration gap and negative security cases are not covered.
- Executed a no-file PoC demonstrating acceptance despite all listed malformed/broken bindings.
- Checked Git state before writing the required artifact: no staged files; existing unrelated untracked files were present.

Residual risks beyond the three requested classifications: permissive hex decoding should be corrected; recovery-kit Bitcoin export currently omits the stored pre-signed transaction; no end-to-end test covers the exact production publisher payload through recipient recovery.

# Next steps

1. Add strict NIP-59 verification and application trusted-publisher binding before accepting a share.
2. Define one typed production payload and exercise publisher → relay event → unwrap → K recovery → share decryption end to end.
3. Keep Bitcoin setup disabled until custody, recipient destination ownership, durable transaction delivery/export, and broadcast/persistence failure handling are redesigned and tested.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Performed only the requested cold protocol/security verification at HEAD b7b7aef1; no project/source files were modified."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Report provides verdicts for A/B/C, exact NIP-59 checks, strongest defenses, executable PoC output, focused test results, and file:line evidence."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/299cf632-9b0a-4aa8-b753-611c0bc425e1/audit-cold/nostr-bitcoin-fp.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git rev-parse HEAD && git status --short && git log -1 --oneline",
      "result": "passed",
      "summary": "Confirmed exact requested HEAD b7b7aef1 and inspected worktree state."
    },
    {
      "command": "cd frontend && bun -e <crafted NIP-59 malformed-binding PoC>",
      "result": "passed",
      "summary": "unwrapGiftWrap returned attacker-controlled payload despite invalid outer id/signature, invalid seal signature, wrong p-tag, mismatched rumor/seal authors, and wrong rumor kind."
    },
    {
      "command": "cd frontend && bun test src/lib/__tests__/recovery-ui.test.ts src/lib/__tests__/nostr.test.ts src/lib/__tests__/secret-bitcoin-flow.test.ts src/lib/__tests__/client-wallet.test.ts src/lib/__tests__/client-operations.test.ts",
      "result": "passed",
      "summary": "102 tests passed, 0 failed, 272 assertions."
    },
    {
      "command": "git diff --stat && git diff --cached --stat && git status --porcelain=v1",
      "result": "passed",
      "summary": "No tracked or staged diff; only pre-existing/unrelated untracked paths were shown."
    }
  ],
  "validationOutput": [
    "A: TRUE POSITIVE, MEDIUM; normal SimplePool queries verify outer signatures upstream, but attacker-valid events and unchecked seal/trusted-author/rumor bindings remain accepted.",
    "B: production blocker; publisher emits JSON-bundled encryptedShare/nonce/encryptedKNostr while recovery treats the bundle as ciphertext hex and never performs Nostr K recovery.",
    "C: production blocker; guard prevents enablement today, while session-only owner/recipient keys and an undistributed recipient destination key can strand funds; recovery-kit status also omits the stored pre-signed transaction.",
    "Focused validation: 102 pass, 0 fail."
  ],
  "residualRisks": [
    "Strict payload schema and strict hex validation are absent.",
    "No production publisher-to-recovery end-to-end test exists.",
    "Bitcoin broadcast/pre-sign/store operations are not atomic and key custody/export is not durable."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added only the required audit artifact; project/source remained unchanged.",
  "reviewFindings": [
    "blocker: frontend/src/lib/services/nostr-publisher.ts:129-143 and frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:181-185 - production payload/consumer mismatch prevents legitimate Nostr recovery.",
    "blocker: frontend/src/lib/components/BitcoinSetup.svelte:56-60,140-145 and frontend/src/lib/bitcoin/client-wallet.ts:33-68 - setup is intentionally disabled; simply enabling it leaves required spend keys session-only and not recipient-controlled.",
    "medium: frontend/src/lib/crypto/recovery-flows.ts:110-142 - missing seal signature, recipient, rumor/seal author, trusted publisher, rumor kind/id, and schema bindings allow attacker-authored share injection."
  ],
  "manualNotes": "plan.md was absent. progress.md was read but reflects an older demo/PR status. Existing untracked files were not modified or staged."
}
```
