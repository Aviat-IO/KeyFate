## Review

Scope: read-only adversarial review of tracked project code at `b7b7aef1a897c418e0402acd211fecf0206d8217` (excluding `.worktrees`, generated, and vendor files). `plan.md` was absent; `progress.md` reports the Bitcoin timelock demo work and its validation.

### Blocker — the advertised zero-knowledge boundary is broken; the server can obtain a reconstruction threshold

- `frontend/src/lib/components/NewSecretForm.svelte:158-174` splits the plaintext in the browser but selects one plaintext share for the server. Lines 180-205 send that share to `/api/secrets`.
- `frontend/src/routes/api/secrets/+server.ts:141-157` receives and encrypts that plaintext share using a server-held key. `frontend/src/lib/encryption.ts:41-79,93-116` loads the AES key from server environment and retains it in process memory. `frontend/src/lib/cron/process-reminders.ts:156-167` confirms the service can decrypt the share.
- When Nostr is enabled, `frontend/src/lib/components/NewSecretForm.svelte:229-249` sends additional plaintext user-managed shares to `/publish-nostr`; `frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:88-104,147-155` accepts them, and `frontend/src/lib/services/nostr-publisher.ts:119-127` performs encryption on the server.
- For the default free-tier 2-of-3 configuration documented/enforced at `frontend/src/routes/api/secrets/+server.ts:130-138`, the server already holds share 1 and receives just one recipient share during Nostr publication, reaching the reconstruction threshold. A compromised application process or operator instrumentation can therefore reconstruct the original secret before publication. With multiple Nostr recipients the endpoint may receive still more shares in one request.
- This directly contradicts the client-side/zero-knowledge design claims and makes server compromise sufficient to disclose complete secrets.

**Required protection:** perform all share encryption and NIP-44/NIP-59 preparation in the browser (or an independently trusted signer) and send only ciphertext/signed events. The service must never observe enough plaintext shares to meet the configured threshold. A server-held transport signing key does not fix plaintext custody.

**Protections checked:** the server share uses AES-256-GCM with random 96-bit IVs and a length/entropy-checked environment key; the Nostr publish route requires session ownership and CSRF. Those controls protect storage and cross-site requests but do not prevent the application/server principal from seeing threshold plaintext.

### Blocker — the shipped Nostr recovery path cannot consume the publisher's payload

- The production publisher serializes `SharePayload.share` as a JSON string containing `{ encryptedShare, nonce, encryptedKNostr }` at `frontend/src/lib/services/nostr-publisher.ts:129-143`.
- Recovery returns that string unchanged at `frontend/src/lib/crypto/recovery-flows.ts:132-142`, but the UI treats the whole JSON string as hex at `frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:181-185`. This necessarily fails before ChaCha20-Poly1305 decryption.
- The UI also exposes only passphrase and OP_RETURN K recovery at `frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:155-175`; it never calls the implemented NIP-44 K recovery function at `frontend/src/lib/crypto/recovery.ts:27-40`, despite requiring the recipient nsec.
- Existing coverage masks the integration break: `frontend/src/lib/__tests__/recovery-ui.test.ts:497-527` constructs a different payload where `share` is directly ciphertext hex, rather than using the production publisher serialization.

**Impact:** a recipient cannot recover a production-published share through the advertised Nostr flow. This is a release blocker for dead-man-switch recovery.

**Required protection:** define and validate one versioned payload schema, parse its `encryptedShare` and per-share `nonce`, recover K from its `encryptedKNostr` using the verified seal sender, and add an end-to-end test that feeds actual `publishSharesToNostr` output into the recovery UI logic.

### Blocker — Bitcoin timelock setup is intentionally unreachable, with latent unrecoverable key custody

- `frontend/src/lib/components/BitcoinSetup.svelte:56-60` hard-codes an all-zero K and event ID. Lines 140-145 always detect that all-zero key and return before transaction construction. The authenticated secret view mounts this component, so the production setup UI cannot enable Bitcoin.
- If that guard were merely removed, the same component generates both owner and recipient keypairs in the owner's browser (`frontend/src/lib/components/BitcoinSetup.svelte:86-101`) and stores both private keys only as plaintext hex in `sessionStorage` (`frontend/src/lib/bitcoin/client-wallet.ts:28-46`).
- The recovery kit includes the pre-signed transaction but no recipient private key (`frontend/src/lib/components/ExportRecoveryKitButton.svelte:85-93,141-159`). The pre-signed transaction sends funds to an address controlled by that recipient key (`frontend/src/lib/bitcoin/transaction.ts:235-245`). After the browser session ends, the recipient cannot spend that output unless the otherwise-unexported key was separately preserved.

**Impact:** Bitcoin recovery is currently unavailable; a superficial enablement risks permanently marooning funds at the recipient output.

**Required protection:** integrate the real per-share K/event ID, use a recipient-supplied public key/address or an explicit encrypted/offline recipient-key handoff, and prove recovery from a fresh recipient environment before enabling mainnet.

**Protections checked:** private keys do not cross the server API; transaction creation uses P2WSH CSV, local signing, and an authenticated pre-signed witness. These do not address unreachable setup or recipient key delivery.

### High — NIP-59 recovery accepts unauthenticated, attacker-authored shares

- The sender signs the seal during creation (`frontend/src/lib/nostr/gift-wrap.ts:75-90`), but recovery only checks numeric kinds and decrypts JSON (`frontend/src/lib/crypto/recovery-flows.ts:110-133`). It does not verify the outer event signature/id, the seal signature/id, rumor id, rumor kind `21059`, rumor/seal pubkey binding, the recipient `p` tag, or an expected KeyFate/owner sender pubkey.
- Relay search accepts every kind-1059 event tagged to the recipient (`frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:90-104`) and presents the outer ephemeral pubkey as the sender; selected events are accepted by `unwrapGiftWrap` at lines 122-146.
- Any attacker who knows the public recipient npub can create their own valid seal/gift wrap encrypted to that recipient and supply arbitrary `secretId`, indices, threshold, and share content. NIP-44 authentication only proves possession of the attacker's selected sender key; without sender pinning/signature-chain validation it does not prove the share came from the intended secret owner/service.

**Impact:** relay injection can poison or confuse recovery, substitute metadata, and cause recipients to reconstruct attacker-chosen/invalid material. For a dead-man-switch recovery channel, this is a high-integrity failure.

**Required protection:** use the NIP-59 verification sequence (verify outer event, recipient tag, seal event/signature, seal/rumor author binding, rumor id/kind) and bind the verified author plus `secretId`/event IDs to authenticated recovery-kit metadata. Reject mixed-author and mixed-secret share sets.

**Protections checked:** `finalizeEvent` signs events on creation and NIP-44 provides ciphertext integrity. No tests exercise forged/self-authored seals, invalid signatures, author pinning, or mixed-secret rejection.

### High — browser Web Storage holds enough plaintext shares to reconstruct common configurations

- `frontend/src/lib/components/NewSecretForm.svelte:169-171` collects every non-server share as plaintext hex. Lines 216-221 place all of them in `localStorage` for 24 hours.
- In the enforced free-tier 2-of-3 configuration, those two stored shares alone reconstruct the complete secret. The same origin also stores plaintext Nostr K values at `frontend/src/lib/components/NewSecretForm.svelte:260-273` and Bitcoin private keys as plaintext hex in `sessionStorage` at `frontend/src/lib/bitcoin/client-wallet.ts:37-46`.
- No application CSP is configured in `frontend/svelte.config.js`, and repository search found no `Content-Security-Policy`/`script-src` enforcement. Any successful same-origin script execution can synchronously exfiltrate a full reconstruction set and key material; the expiry timestamp is application metadata, not browser-enforced deletion.

**Required protection:** do not persist a reconstruction threshold in script-readable storage. Require immediate encrypted export/recipient distribution, encrypt any temporary custody under a user-held key unavailable to normal page scripts, actively remove expired entries, and deploy a strict nonce/hash-based CSP as defense in depth.

**Protections checked:** storage is origin-scoped and labeled with a 24-hour expiry, but it is neither encrypted nor automatically expired and is readable by all same-origin JavaScript.

### Protections verified without Medium-or-higher findings

- ChaCha20-Poly1305 uses fresh random 96-bit nonces and 256-bit keys (`frontend/src/lib/crypto/symmetric.ts`).
- Passphrase recovery uses PBKDF2-SHA256 with 600,000 iterations, random 128-bit salts, and AES-256-GCM with random 96-bit nonces (`frontend/src/lib/crypto/passphrase.ts`).
- Targeted crypto/Nostr/Bitcoin unit tests passed, including AEAD tamper tests. They do not cover the production serialization mismatch, sender authentication, threshold custody, or currently guarded Bitcoin UI.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Performed only the requested read-only cryptography/secret-custody/Bitcoin/Nostr review at HEAD b7b7aef1; no project or source files were modified."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Each Medium-or-higher finding includes concrete file:line traces, impact, required protection, and existing protections checked."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/0a942041-338c-4359-b2b2-e6dabedccf5b/audit/crypto-nostr-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git rev-parse HEAD && git status --short && git status --porcelain=v1 --untracked-files=no && git diff --stat && git diff --cached --stat",
      "result": "passed",
      "summary": "Verified HEAD b7b7aef1a897c418e0402acd211fecf0206d8217 and no tracked/staged changes."
    },
    {
      "command": "cd frontend && bun test src/lib/__tests__/double-encryption.test.ts src/lib/__tests__/nostr.test.ts src/lib/__tests__/recovery-ui.test.ts src/lib/__tests__/bitcoin.test.ts src/lib/__tests__/client-wallet.test.ts src/lib/__tests__/client-operations.test.ts src/lib/__tests__/e2e-bitcoin-nostr.test.ts src/lib/__tests__/secret-bitcoin-flow.test.ts",
      "result": "passed",
      "summary": "220 passed, 0 failed; tests expose coverage gaps because recovery fixtures do not use production publisher serialization."
    },
    {
      "command": "targeted rg/read/nl inspection of crypto, Nostr, Bitcoin, API, recovery, storage, and test files",
      "result": "passed",
      "summary": "Traced key generation, encryption, serialization, server custody, signing, relay query, transaction, and recovery boundaries."
    }
  ],
  "validationOutput": [
    "HEAD exactly b7b7aef1a897c418e0402acd211fecf0206d8217.",
    "Targeted security-relevant suite: 220 pass, 0 fail, 538 expectations across 8 files.",
    "git diff --cached --name-only returned empty; tracked status was clean."
  ],
  "residualRisks": [
    "No live relay, browser E2E, signet/mainnet, or credentialed deployment exercise was performed.",
    "NIP-46 is not implemented in the inspected flow, so there was no NIP-46 authorization/session implementation to validate.",
    "Relay publication treats one successful relay as success despite MIN_PUBLISH_RELAYS=3 being warning-only; durability remains operationally unproven."
  ],
  "noStagedFiles": true,
  "diffSummary": "No project/source diff; only this required audit artifact was written.",
  "reviewFindings": [
    "blocker: frontend/src/lib/components/NewSecretForm.svelte:158-249 - server receives enough plaintext shares to reach the reconstruction threshold",
    "blocker: frontend/src/lib/services/nostr-publisher.ts:129-143 and frontend/src/lib/components/recovery/NostrRecoveryStep.svelte:181-185 - publisher/recovery payload formats are incompatible",
    "blocker: frontend/src/lib/components/BitcoinSetup.svelte:56-60,140-145 - Bitcoin setup is hard-disabled; recipient spend key has no recovery handoff",
    "high: frontend/src/lib/crypto/recovery-flows.ts:110-142 - NIP-59 signature/author/binding verification is absent",
    "high: frontend/src/lib/components/NewSecretForm.svelte:216-221 - script-readable localStorage holds a reconstruction set in common configurations"
  ],
  "manualNotes": "plan.md was not present. progress.md was read and left unchanged as required by the read-only scope."
}
```
