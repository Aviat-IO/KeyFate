# Adversarial Review: Server reaches the Shamir reconstruction threshold

Finding-Ref: `piolium/findings-draft/H1-server-reaches-shamir-threshold.md`  
Reviewer-Agent: fresh cold verifier (`crypto-custody-fp`)  
Date: 2026-07-11

## Independent Restatement

The default 2-of-3 Nostr-enabled creation path sends two distinct plaintext Shamir shares through server endpoints before server-side encryption/publishing, so code executing in the application trust domain can reconstruct the original secret.

## Sub-claim Decomposition

- Sub-claim A (default threshold is two): confirmed by `ThresholdSelector.svelte` and creation validation.
- Sub-claim B (server receives share 0): confirmed at `NewSecretForm.svelte` → `/api/secrets` → server-side AES storage.
- Sub-claim C (server receives a distinct user-managed share): confirmed at `NewSecretForm.svelte` → `/publish-nostr` → `publishSharesToNostr` before double encryption.
- Sub-claim D (two shares reconstruct): confirmed using the shipped `shamirs-secret-sharing` implementation.

Sub-claim result: all coherent.

## Independent Code Path Trace

1. `frontend/src/lib/components/NewSecretForm.svelte:158-205` creates shares in the browser.
2. `NewSecretForm.svelte:229-249` posts `shares[0]` to the secret API.
3. `frontend/src/routes/api/secrets/+server.ts:141-166` receives/encrypts/stores that share.
4. Nostr setup posts a different `userManagedShares[idx]` to `frontend/src/routes/api/secrets/[id]/publish-nostr/+server.ts:88-104`.
5. `frontend/src/lib/services/nostr-publisher.ts:119-143` receives plaintext and only then double-encrypts it.

## Protections Checked

| Layer | Protection Found | Blocks Attack? |
|---|---|---|
| Language | typed share objects | No |
| Framework | TLS and authenticated/owned secret routes | No; application process still receives request plaintext |
| Middleware | session and ownership checks | No; threat is application trust domain/operator compromise, not another tenant |
| Application | server share encrypted promptly; Nostr share double-encrypted before relay | No; both transformations occur after receipt |
| Documentation | explicit zero-knowledge/no-server-plaintext claims | Confirms this is unintended |

## Real-Environment Reproduction

Environment type: web application / cryptographic library  
Provisioning method: local installed dependency; full staging instrumentation blocked

Healthcheck result: source build/test pass.  
Attempt 1: generated real 2-of-3 shares and combined indexes 0 and 1 — recovered marker exactly.  
Evidence: `piolium/findings/H1-server-reaches-shamir-threshold/evidence/shamir-reconstruction.log`.

PoC-Status: theoretical  
Block reason: no credentialed staging environment was available to instrument real HTTP request bodies; source tracing establishes the application receipt path and the local library proof establishes threshold sufficiency.

## Prosecution Brief

The product's security contract is that the service cannot reconstruct secrets. A normal shipped feature sends a threshold set through one application process. Application logging/APM, compromised runtime code, a malicious operator, or dependency executing during creation can combine them without database compromise. TLS does not help after request termination.

## Defense Brief

The two shares are not normally persisted together in plaintext and require observing two separate authenticated requests in one setup. The server promptly encrypts/publishes them, and a passive database-only attacker does not automatically obtain both. These facts constrain attacker position but do not restore the promised application-process trust boundary.

## Severity Challenge

Severity-Original: HIGH  
Severity-Challenge: HIGH  
Justification: complete secret disclosure is possible to a compromised service trust domain in a default configuration, but exploitation requires runtime/operator observation during creation rather than anonymous remote input.

## Verdict

Adversarial-Verdict: CONFIRMED  
Adversarial-Rationale: Two independently traced server request paths carry distinct shares in the default 2-of-3 scheme, and no protection prevents the application process from combining them.
