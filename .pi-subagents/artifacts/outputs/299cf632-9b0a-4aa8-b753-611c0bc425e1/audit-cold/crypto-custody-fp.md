## Review

Scope: cold, read-only false-positive verification of the two supplied claims at tracked HEAD `b7b7aef1a897c418e0402acd211fecf0206d8217`. The requested `plan.md` does not exist; `progress.md` describes unrelated Bitcoin timelock-demo work. No project/source files were modified.

### Claim A — authenticated global application-key decryption oracle

**Restatement.** An attacker with any valid KeyFate session who separately obtains a current-version AES-GCM tuple (`serverShare`, `iv`, `authTag`) can submit that tuple to `POST /api/decrypt`. The endpoint decrypts it with the process-wide application key and returns plaintext, without proving that the ciphertext belongs to the caller or requiring recent authentication.

**Source-to-sink trace.** The normal creation flow sends a plaintext SSS server share to `POST /api/secrets` (`frontend/src/lib/components/NewSecretForm.svelte:174-205`). The API encrypts it with `encryptMessage` and stores the resulting ciphertext, IV, and tag under the creating user (`frontend/src/routes/api/secrets/+server.ts:141-168`). `encryptMessage` selects the environment-backed key by version, with the current version fixed to 1, and AES-256-GCM encrypts under that shared process key (`frontend/src/lib/encryption.ts:41-79,85-117`). The alleged oracle accepts caller-selected `encryptedMessage`, `iv`, and `authTag`, performs only `requireSession`, invokes `decryptMessage` without an object ID, owner ID, AAD, or key version, and returns the plaintext (`frontend/src/routes/api/decrypt/+server.ts:12-28`). `decryptMessage` defaults to key version 1 and uses the same global key loader (`frontend/src/lib/encryption.ts:121-138`). Current creation also uses version 1, so current stored tuples are compatible.

**Protection-layer search.**

- Authentication exists: `requireSession` rejects callers without a session (`frontend/src/routes/api/decrypt/+server.ts:14`; `frontend/src/lib/server/auth.ts:31-49`). It does not authorize a secret or tenant.
- AES-256-GCM, a random 12-byte IV, a 32-byte key-length check, and an entropy check are correctly used (`frontend/src/lib/encryption.ts:56-66,85-115`). GCM rejects altered tuples, but a valid exposed tuple decrypts; authenticity is not ownership.
- Normal list/detail queries owner-filter secrets. The list mapping deliberately returns ciphertext, IV, and tag for the authenticated user's objects (`frontend/src/routes/api/secrets/+server.ts:25-28`; `frontend/src/lib/db/secret-mapper.ts:43-60`). I found no direct cross-tenant ciphertext IDOR in the reviewed secret routes.
- The dedicated reveal/export routes require CSRF, recent authentication, and an `(id, userId)` database match before returning ciphertext or plaintext (`frontend/src/routes/api/secrets/[id]/reveal-server-share/+server.ts:34-69`; `frontend/src/routes/api/secrets/[id]/export-share/+server.ts:44-85`). `/api/decrypt` applies none of these object/re-authentication controls and therefore bypasses their intended boundary once a tuple is known.
- Repository search found no production caller or test for `/api/decrypt`; only the route itself references that URL. There is no ciphertext registry lookup, tenant key derivation, per-user key, AAD binding, recent-authentication check, explicit CSRF helper, or endpoint rate limit.
- Qualification: the endpoint omits `keyVersion`, so it only decrypts version 1. That covers all ciphertext created by this HEAD; it would not automatically cover a future non-v1 tuple. A valid authentication tag is practically required despite the endpoint's zero-tag fallback.

**Strongest prosecution.** This is a classic confused-deputy/oracle primitive: possession of encrypted-at-rest material plus an ordinary account is promoted to plaintext access. The contrast with the protected export route is especially strong evidence that session-only authorization is insufficient. A read-only database/backup/telemetry disclosure that should expose only ciphertext becomes plaintext disclosure across all tenants encrypted with version 1.

**Strongest defense.** The endpoint does not itself disclose another tenant's ciphertext. A remote attacker must first acquire all three valid tuple components and a valid account/session. AES-GCM prevents guessing or tampering, normal object routes are owner-filtered, and one decrypted server share alone is normally below the SSS threshold. Thus this is not an unauthenticated direct dump of complete original secrets, and its impact depends on a separate ciphertext exposure or chain.

**Attacker prerequisites.** (1) Any authenticated session; (2) a valid version-1 ciphertext/IV/tag tuple, obtained from a separate database/backup/logging/ciphertext exposure or another authorized context; (3) ability to send a same-origin/authenticated POST. No ownership of the corresponding secret and no recent reauthentication are needed.

**Pseudocode PoC.**

```text
login(low_privilege_account)
tuple = separately_exposed_victim_record(serverShare, iv, authTag)
POST /api/decrypt with session cookie and {
  encryptedMessage: tuple.serverShare,
  iv: tuple.iv,
  authTag: tuple.authTag
}
=> 200 { decryptedMessage: victim_plaintext_sss_share }
```

**Gate review.** Process: pass (full flow/protections/defense checked). Reachability: pass for an authenticated caller with a valid tuple. Real impact: pass—plaintext information disclosure defeats encryption-at-rest separation. PoC: pass by direct route trace plus the passing encryption round-trip tests. Math: pass—creation and oracle both select version 1, so `decrypt_K1(encrypt_K1(M)) = M` for a valid IV/tag. Environment: pass—TLS, sessions, and GCM do not bind the tuple to an owner.

**Verdict: TRUE POSITIVE — MEDIUM.** The claim is accurate for current version-1 application ciphertexts. MEDIUM is appropriate because exploitation requires both authentication and a separate valid-tuple exposure; there is no verified direct cross-tenant ciphertext leak in this claim.

### Claim B — Nostr publishing violates the zero-knowledge threshold boundary

**Restatement.** In the legitimate Nostr-enabled creation flow, the application server receives one plaintext SSS share for storage and then receives additional plaintext user-managed SSS shares for Nostr encryption. Whenever the number of Nostr shares sent is at least `threshold - 1`, the server has access to a reconstruction threshold, contradicting the stated guarantee that it never has enough shares or access to the original secret.

**Source-to-sink trace.** `NewSecretForm` defaults to 3 total shares with threshold 2, splits the original message in the browser, identifies share 0 as the server share, and sends its plaintext hex to `/api/secrets` (`frontend/src/lib/components/NewSecretForm.svelte:53-54,158-205`). `/api/secrets` receives that plaintext and encrypts it with the server-held AES key before storage (`frontend/src/routes/api/secrets/+server.ts:141-168`). The same browser retains shares 1..N-1, then for each Nostr-enabled recipient maps a user-managed share into a request to `/api/secrets/{id}/publish-nostr` (`frontend/src/lib/components/NewSecretForm.svelte:169-171,223-249`). The publish endpoint validates but preserves the plaintext `share` string, confirms secret/recipient ownership, and passes it into the server-side publisher (`frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:62-75,78-155`). Only inside that server-side service is `shareInput.share` double-encrypted (`frontend/src/lib/services/nostr-publisher.ts:111-127`). Therefore transport encryption and Nostr encryption occur after the application has received the share in plaintext.

The advertised boundary is explicit: original secrets supposedly never leave the device; the server stores only one insufficient share; reconstruction from the server alone is claimed impossible (`openspec/project.md:5-9,118-128,163-165`; `frontend/src/routes/faq/+page.svelte:15-17`).

**Threshold proof and tier constraints.** Let `T` be the configured threshold and `R` the count of distinct user-managed shares submitted for Nostr. The application can decrypt its stored share 0, so it can access `1 + R` distinct plaintext shares. Reconstruction is possible exactly when `1 + R >= T`, or `R >= T - 1`. The default form values are `N=3, T=2`; the Pro selector also initializes to these defaults (`frontend/src/lib/components/NewSecretForm.svelte:53-54`; `frontend/src/lib/components/ThresholdSelector.svelte:8-10`). Thus one Nostr recipient supplies share 1 and makes `1 + 1 = 2 = T`. The executable SSS check recovered `cold-fp-threshold-proof` from shares 0 and 1 and reported `matches:true`.

Nostr controls are shown only to paid users (`frontend/src/lib/components/NewSecretForm.svelte:517-552`), so the vulnerable normal UI combination is **Pro default 2-of-3**, not free-tier Nostr. Pro permits thresholds from 2 through total shares and at most 7 total shares (`frontend/src/lib/tier-validation.ts:15-40`; `frontend/src/lib/components/ThresholdSelector.svelte:61-99`). Multiple paid recipients can cause multiple distinct user-managed shares to be sent (`frontend/src/lib/components/NewSecretForm.svelte:229-249,471-487`). The claim is not universal for every Pro configuration: e.g. a 7-of-7 secret with only one Nostr recipient gives the server 2 shares, below threshold. It is true whenever `R >= T-1`, including the shipped default with one Nostr recipient.

**Protection-layer search.**

- Secret creation requires CSRF, authentication, email verification, tier checks, threshold checks, and a creation rate limit (`frontend/src/routes/api/secrets/+server.ts:35-139`). These protect account/business operations, not plaintext from the application principal.
- Nostr publication requires CSRF, authentication, secret ownership, and recipient membership (`frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:78-138`). Existing tests verify authentication and ownership. Those checks stop other users from publishing against the object but do not stop the server handling the plaintext body.
- TLS protects the shares in transit from network observers. AES-GCM protects share 0 at rest. NIP-44/NIP-59 and double encryption protect published data from relay observers/unauthorized recipients. None prevent the application process from observing request plaintext or decrypting its stored share.
- The publish route bounds metadata to 2..7/3..7 but does not compare it to the stored secret's threshold. More importantly, even perfect metadata consistency would not restore zero knowledge because the server-side publisher still receives raw shares.
- No browser-side `doubleEncryptShare` or prebuilt ciphertext/event handoff exists in this creation caller. Encryption occurs at the sink after plaintext receipt.
- The service does not appear to persist the Nostr plaintext share after publishing. Non-persistence reduces exposure duration but does not satisfy a zero-knowledge/no-access guarantee; a compromised process, operator instrumentation, request tracing, or malicious deployment can retain it and decrypt share 0.

**Strongest prosecution.** This is a deterministic, normal-product path, not a malformed-input edge case. A Pro user accepts the default 2-of-3 settings, enables Nostr, and supplies one Nostr pubkey. The same application trust domain then receives share 0 and share 1 associated with the same secret ID. A compromised application process—or the service operator the zero-knowledge claim promises users need not trust—can reconstruct the original secret before Nostr publication. Server-side Nostr encryption cannot retroactively erase that disclosure.

**Strongest defense.** SSS splitting itself is client-side; the database stores only one AES-GCM ciphertext; the Nostr plaintext share is transient and is encrypted before relay publication. The route is owner/CSRF protected, Nostr is optional/Pro-only/default-off, and higher thresholds or too few Nostr-enabled recipients leave the server below threshold. If the intended threat model trusts the live application server and defines “zero knowledge” only as “not stored in plaintext,” the implementation may be operationally acceptable—but that is incompatible with the project's unqualified statements that the server never has access and can never reconstruct.

**Attacker prerequisites.** For confidentiality exploitation: control/compromise/inspection of the application process or deployment while a Pro user enables Nostr, plus a configuration sending at least `T-1` distinct Nostr shares. For the shipped default 2-of-3, one Nostr-enabled recipient suffices. No cryptographic break, victim-account takeover, or relay compromise is required.

**Pseudocode PoC.**

```text
# Legitimate Pro default flow
shares = SSS.split(original_secret, N=3, T=2)
POST /api/secrets { server_share: hex(shares[0]), ... }
# application sees shares[0], then encrypts/stores it with application key
POST /api/secrets/{id}/publish-nostr {
  shares: [{ share: hex(shares[1]), recipientId: owned_recipient }],
  threshold: 2,
  totalShares: 3
}
# application sees shares[1] before server-side doubleEncryptShare
recovered = SSS.combine([shares[0], shares[1]])
assert recovered == original_secret
```

**Gate review.** Process: pass. Reachability: pass through the normal Pro UI/API flow. Real impact: pass—complete original-secret disclosure to the server trust domain. PoC: pass—the executable SSS proof reconstructed from exactly the two shares the server receives in the default path; the publish-route tests confirm plaintext `share` reaches `publishSharesToNostr`. Math: pass when `R >= T-1`, including default `T=2, R=1`; explicitly not universal for configurations where that inequality fails. Environment: pass—TLS and subsequent encryption do not prevent the server endpoint from seeing request plaintext.

**Verdict: TRUE POSITIVE — HIGH, with configuration qualification.** The broadest possible reading (“Nostr enabled always means enough shares”) would be false for high-threshold/few-recipient configurations, but the security claim is broken by a normal shipped configuration, including the Pro defaults. HIGH reflects complete disclosure of highly sensitive original secrets to a trust domain explicitly advertised as unable to access them.

### Final false-positive summary

- **TRUE POSITIVES: 2.** Claim A is a session-gated but object-unbound global version-1 decryption oracle (MEDIUM). Claim B allows the application server to reach an SSS threshold in the default Nostr-enabled Pro flow (HIGH, conditional on `R >= T-1`).
- **FALSE POSITIVES: 0.**
- **Residual risks/limits:** No live deployment was exercised. No direct cross-tenant ciphertext acquisition path was established for Claim A. Claim B's threshold condition varies with configured threshold and count of Nostr-enabled recipients.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Performed only the requested cold read-only verification of Claims A and B at HEAD b7b7aef1; no project/source changes were made."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Each claim includes line-cited source-to-sink tracing, protection search, prosecution/defense, prerequisites, pseudocode PoC, six-gate review, verdict, severity, and explicit qualifications."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/299cf632-9b0a-4aa8-b753-611c0bc425e1/audit-cold/crypto-custody-fp.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git status --short && git rev-parse HEAD && git diff --stat && git diff --cached --stat",
      "result": "passed",
      "summary": "Confirmed HEAD b7b7aef1a897c418e0402acd211fecf0206d8217, pre-existing untracked files, and no staged diff."
    },
    {
      "command": "cd frontend && bun test src/lib/__tests__/encryption.test.ts 'src/routes/api/secrets/[id]/publish-nostr/__tests__/publish-nostr.test.ts'",
      "result": "passed",
      "summary": "24 tests passed, 0 failed; confirms AES-GCM round trips and that authenticated/owned plaintext share input reaches the Nostr publisher."
    },
    {
      "command": "cd frontend && bun -e <2-of-3 shamirs-secret-sharing reconstruction check>",
      "result": "passed",
      "summary": "Combined shares 0 and 1 from a 2-of-3 split; recovered the original string with matches:true."
    },
    {
      "command": "repository grep/find/read and nl -ba inspections for decrypt, encryption, secret routes, NewSecretForm, Nostr publisher, threshold controls, callers, specs, and tests",
      "result": "passed",
      "summary": "Verified complete flows and cited exact source lines; found no production /api/decrypt caller or secondary object/re-authentication control."
    }
  ],
  "validationOutput": [
    "Tracked HEAD: b7b7aef1a897c418e0402acd211fecf0206d8217.",
    "Targeted Bun tests: 24 pass, 0 fail, 56 expectations.",
    "SSS proof output: {shareCount:3, threshold:2, serverObservedShares:2, recovered:'cold-fp-threshold-proof', matches:true}.",
    "plan.md was absent; progress.md was read and concerns unrelated Bitcoin timelock-demo work."
  ],
  "residualRisks": [
    "Claim A requires a separately exposed valid ciphertext/IV/tag tuple; this review did not establish a direct cross-tenant tuple leak.",
    "Claim B reaches threshold only when Nostr plaintext share count R satisfies R >= T-1; the shipped Pro default does, but not every possible configuration.",
    "No live deployment or network-level PoC was exercised."
  ],
  "noStagedFiles": true,
  "diffSummary": "No project/source diff; only the required audit artifact was created.",
  "reviewFindings": [
    "blocker: frontend/src/routes/api/decrypt/+server.ts:12-28 - any authenticated session can decrypt caller-supplied version-1 application ciphertext without ownership or recent authentication (TRUE POSITIVE, MEDIUM)",
    "blocker: frontend/src/lib/components/NewSecretForm.svelte:158-249 and frontend/src/lib/services/nostr-publisher.ts:111-127 - default Nostr-enabled Pro flow gives the server two plaintext shares for a 2-of-3 secret before server-side encryption (TRUE POSITIVE, HIGH)",
    "note: Claim B is configuration-dependent; R >= T-1 is the exact threshold condition."
  ],
  "manualNotes": "Cold verification was performed from code/tests/specs. Source files were not modified."
}
```
